terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://${google_container_cluster.primary.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.primary.master_auth[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = "https://${google_container_cluster.primary.endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(google_container_cluster.primary.master_auth[0].cluster_ca_certificate)
  }
}

resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.region

  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  release_channel {
    channel = "REGULAR"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
}

resource "google_container_node_pool" "primary_nodes" {
  name       = "${var.cluster_name}-node-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name

  # Start with 1 node per zone to avoid quota issues
  node_locations = [
    "${var.region}-a"
  ]

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = 30
    disk_type    = "pd-standard"

    # Use spot instances to reduce cost
    spot = true

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      env = var.environment
    }

    tags = ["flappy-royale"]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

resource "google_compute_network" "vpc" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.cluster_name}-subnet"
  ip_cidr_range = "10.0.0.0/16"
  region        = var.region
  network       = google_compute_network.vpc.name

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }
}

resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "flappy-royale"
  format        = "DOCKER"
}

resource "kubernetes_deployment" "flappy_server" {
  depends_on = [google_container_node_pool.primary_nodes]

  metadata {
    name = "flappy-royale-server"
    labels = {
      app = "flappy-royale-server"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "flappy-royale-server"
      }
    }

    template {
      metadata {
        labels = {
          app = "flappy-royale-server"
        }
      }

      spec {
        container {
          name  = "server"
          image = "${var.region}-docker.pkg.dev/${var.project_id}/flappy-royale/flappy-royale-server:latest"

          port {
            container_port = 8080
            name           = "http"
          }

          env {
            name  = "PORT"
            value = "8080"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "flappy_server" {
  depends_on = [google_container_node_pool.primary_nodes]

  metadata {
    name = "flappy-royale-server"
    labels = {
      app = "flappy-royale-server"
    }
  }

  spec {
    type = "ClusterIP" # Changed from LoadBalancer - now using Ingress

    selector = {
      app = "flappy-royale-server"
    }

    port {
      port        = 8080
      target_port = 8080
      protocol    = "TCP"
      name        = "http"
    }

    session_affinity = "None" # Ingress will handle routing
  }
}

# Install nginx Ingress Controller
resource "helm_release" "nginx_ingress" {
  name       = "nginx-ingress"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  namespace  = "ingress-nginx"
  create_namespace = true

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/gcp-load-balancer-type"
    value = "External"
  }

  set {
    name  = "controller.allowSnippetAnnotations"
    value = "true"
  }
}

# Ingress with URL-based consistent hashing
resource "kubernetes_ingress_v1" "flappy_server" {
  depends_on = [helm_release.nginx_ingress]

  metadata {
    name = "flappy-royale-ingress"
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
      # Consistent hash based on URI for room-based sticky sessions
      "nginx.ingress.kubernetes.io/upstream-hash-by" = "$request_uri"
      # Enable WebSocket support - backend protocol must be set for WebSocket
      "nginx.ingress.kubernetes.io/backend-protocol" = "HTTP"
      "nginx.ingress.kubernetes.io/proxy-read-timeout" = "3600"
      "nginx.ingress.kubernetes.io/proxy-send-timeout" = "3600"
      "nginx.ingress.kubernetes.io/proxy-http-version" = "1.1"
      "nginx.ingress.kubernetes.io/proxy-connect-timeout" = "10"
      "nginx.ingress.kubernetes.io/proxy-buffering" = "off"
    }
  }

  spec {
    rule {
      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.flappy_server.metadata[0].name
              port {
                number = 8080
              }
            }
          }
        }
        path {
          path      = "/ws"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.flappy_server.metadata[0].name
              port {
                number = 8080
              }
            }
          }
        }
        path {
          path      = "/ws/room"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.flappy_server.metadata[0].name
              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "flappy_server" {
  depends_on = [google_container_node_pool.primary_nodes]

  metadata {
    name = "flappy-royale-server-hpa"
  }

  spec {
    min_replicas = 1
    max_replicas = 10

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = "flappy-royale-server"
    }

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }

    behavior {
      scale_up {
        stabilization_window_seconds = 30
        select_policy                = "Max"

        policy {
          type           = "Percent"
          value          = 100
          period_seconds = 15
        }

        policy {
          type           = "Pods"
          value          = 4
          period_seconds = 15
        }
      }

      scale_down {
        select_policy                = "Min"
        stabilization_window_seconds = 300

        policy {
          type           = "Percent"
          value          = 50
          period_seconds = 60
        }
      }
    }
  }
}

# ===================================
# Lobby Infrastructure (Firestore + Cloud Functions + API Gateway)
# ===================================

# Enable required APIs
resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudfunctions" {
  service            = "cloudfunctions.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudbuild" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "apigateway" {
  service            = "apigateway.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "servicemanagement" {
  service            = "servicemanagement.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "servicecontrol" {
  service            = "servicecontrol.googleapis.com"
  disable_on_destroy = false
}

# Firestore Database
resource "google_firestore_database" "lobby" {
  depends_on = [google_project_service.firestore]

  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Enable point-in-time recovery for production
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"

  # Delete protection
  delete_protection_state = "DELETE_PROTECTION_DISABLED"
}

# Cloud Storage bucket for Cloud Functions source code
resource "google_storage_bucket" "functions_bucket" {
  name     = "${var.project_id}-lobby-functions"
  location = var.region

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Package and upload function source code
# Each function directory needs package.json and index.js
# Dependencies are installed during Cloud Build
data "archive_file" "function_source" {
  for_each = toset(["createRoom", "getRoom", "joinRoom", "leaveRoom", "updateRoomState"])

  type        = "zip"
  source_dir  = "${path.module}/../lobby/${each.key}"
  output_path = "${path.module}/.terraform/tmp/${each.key}.zip"

  excludes = [
    "node_modules"
  ]
}

resource "google_storage_bucket_object" "function_source" {
  for_each = data.archive_file.function_source

  name   = "functions/${each.key}-${data.archive_file.function_source[each.key].output_md5}.zip"
  bucket = google_storage_bucket.functions_bucket.name
  source = data.archive_file.function_source[each.key].output_path
}

# Cloud Functions (Gen 2)
resource "google_cloudfunctions2_function" "lobby_functions" {
  for_each = toset(["createRoom", "getRoom", "joinRoom", "leaveRoom", "updateRoomState"])

  depends_on = [
    google_project_service.cloudfunctions,
    google_project_service.cloudbuild
  ]

  name     = each.key
  location = var.region

  build_config {
    runtime     = "nodejs20"
    entry_point = each.key
    source {
      storage_source {
        bucket = google_storage_bucket.functions_bucket.name
        object = google_storage_bucket_object.function_source[each.key].name
      }
    }
  }

  service_config {
    max_instance_count = 10
    min_instance_count = 0
    available_memory   = "256M"
    timeout_seconds    = 60

    environment_variables = {
      FIRESTORE_DATABASE = google_firestore_database.lobby.name
    }

    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
  }
}

# IAM to allow unauthenticated access to functions
resource "google_cloudfunctions2_function_iam_member" "invoker" {
  for_each = google_cloudfunctions2_function.lobby_functions

  project        = each.value.project
  location       = each.value.location
  cloud_function = each.value.name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

# API Gateway
# Note: API Gateway resources are not supported in the standard Google provider
# These resources need to be managed separately (e.g., via gcloud or google-beta provider)
# TODO: Migrate to google-beta provider if API Gateway management is needed
#
# resource "google_api_gateway_api" "lobby_api" {
#   depends_on = [google_project_service.apigateway]
#   provider = google
#   api_id   = "lobby-api"
# }

# Generate OpenAPI spec dynamically with function URLs
# locals {
#   openapi_spec = templatefile("${path.module}/lobby-api-spec.yaml", {
#     createRoom_url       = google_cloudfunctions2_function.lobby_functions["createRoom"].service_config[0].uri
#     getRoom_url          = google_cloudfunctions2_function.lobby_functions["getRoom"].service_config[0].uri
#     joinRoom_url         = google_cloudfunctions2_function.lobby_functions["joinRoom"].service_config[0].uri
#     leaveRoom_url        = google_cloudfunctions2_function.lobby_functions["leaveRoom"].service_config[0].uri
#     updateRoomState_url  = google_cloudfunctions2_function.lobby_functions["updateRoomState"].service_config[0].uri
#   })
# }

# resource "google_api_gateway_api_config" "lobby_config" {
#   depends_on = [google_project_service.servicemanagement]
#   provider      = google
#   api           = google_api_gateway_api.lobby_api.api_id
#   api_config_id = "lobby-config"
#   openapi_documents {
#     document {
#       path     = "spec.yaml"
#       contents = base64encode(local.openapi_spec)
#     }
#   }
#   lifecycle {
#     create_before_destroy = true
#   }
# }

# resource "google_api_gateway_gateway" "lobby_gateway" {
#   depends_on = [google_project_service.servicecontrol]
#   provider = google
#   api_config = google_api_gateway_api_config.lobby_config.id
#   gateway_id = "lobby-gateway"
#   region     = var.region
# }
