import { Application, Container, Graphics, Sprite, Assets, Text } from 'pixi.js';

interface Player {
    id: string;
    name: string;
    sprite: Container;
    nameText: any; // PIXI.Text
    x: number;
    y: number;
    score: number;
    alive: boolean;
}

interface ParallaxLayer {
    container: Container;
    speed: number;
    x: number;
}

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const PIPE_WIDTH = 120;
const PIPE_GAP = 200;
const PIPE_SPEED = 3;
const GRAVITY = 0.25;
const JUMP_POWER = -6;
const PLAYER_RADIUS = 12;
const HITBOX_BUFFER = 2;
const EFFECTIVE_RADIUS = PLAYER_RADIUS - HITBOX_BUFFER;
const GROUND_HEIGHT = 50;
const PLAYER_X = GAME_WIDTH / 2; // Player is always at x=512 in game coordinates

export class GameRenderer {
    private app: Application;
    private stage: Container;
    private players: Map<string, Player> = new Map();
    private pipes: Array<{ x: number; gapY: number; scored?: boolean; container: Container }> = [];
    private playerY = GAME_HEIGHT / 2;
    private playerVelocityY = 0;
    private pipeCounter = 0;
    private score = 0;
    private background: Graphics;
    private playerContainer: Container;
    private localPlayerId: string | null = null;
    private parallaxLayers: ParallaxLayer[] = [];
    private gameSpeed: number = 0;
    private resizeHandler: () => void;
    private static instance: GameRenderer | null = null;
    private static instanceId: string = Math.random().toString(36).substr(2, 9);

    constructor(container: HTMLElement) {
        // Prevent multiple instances entirely
        if (GameRenderer.instance) {
            console.error(`❌ ERROR: GameRenderer instance ${GameRenderer.instanceId} already exists! Attempted to create new instance. This causes pipe jumping!`);
            throw new Error(`Multiple GameRenderer instances not allowed! Existing: ${GameRenderer.instanceId}, New: ${GameRenderer.instanceId}`);
        }

        console.log(`✅ Creating new GameRenderer instance ${GameRenderer.instanceId} - the ONLY one allowed`);
        GameRenderer.instance = this;

        this.app = new Application();
        this.stage = new Container();
        this.background = new Graphics();
        this.playerContainer = new Container();

        this.init(container);
    }

    // Static method to get the singleton instance
    static getInstance(): GameRenderer | null {
        return GameRenderer.instance;
    }

    // Method to destroy the instance
    destroy() {
        console.log(`Destroying GameRenderer instance`);
        GameRenderer.instance = null;

        // Remove event listener to prevent post-destruction calls
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        // Destroy the app
        if (this.app) {
            this.app.destroy(true);
            this.app = null as any;
        }
    }

    private async init(container: HTMLElement) {
        await this.app.init({
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            backgroundColor: 0x87ceeb,
            antialias: true,
        });

        // Clear any existing canvases first
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        container.appendChild(this.app.canvas);

        // Set up container for scaling
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';

        // Set canvas style to scale
        this.app.canvas.style.maxWidth = '100%';
        this.app.canvas.style.maxHeight = '100%';
        this.app.canvas.style.width = 'auto';
        this.app.canvas.style.height = 'auto';

        this.app.stage.addChild(this.stage);

        // Create parallax background
        await this.createParallaxBackground();

        // Ground layer (on top of parallax)
        this.drawBackground();
        this.stage.addChild(this.background);

        // Player container
        this.playerContainer = await this.drawPlayer();
        this.stage.addChild(this.playerContainer);

        // Initial resize calculation
        this.calculateScale();

        // Resize handler
        this.resizeHandler = () => this.onResize();
        window.addEventListener('resize', this.resizeHandler);
    }

      private async createParallaxBackground() {
        console.log('🌤️ Loading parallax background...');
        try {
            const skyTexture = await Assets.load('/sky1.png');
            console.log('✅ Sky background loaded successfully');

            // Create 3 parallax layers with different speeds
            const layerConfigs = [
                { speed: 0.05, alpha: 0.4, scale: 1.0 },  // Far clouds - very slow
                { speed: 0.1, alpha: 0.6, scale: 1.1 },  // Mid clouds - slow
                { speed: 0.15, alpha: 0.8, scale: 1.2 }   // Near clouds - medium
            ];

            for (const config of layerConfigs) {
                const container = new Container();
                container.alpha = config.alpha;

                const scaledWidth = GAME_WIDTH * config.scale;
                const scaledHeight = GAME_HEIGHT * config.scale;

                // Create two instances for seamless scrolling
                for (let i = 0; i < 2; i++) {
                    const skySprite = new Sprite(skyTexture);

                    // Scale and position precisely
                    skySprite.width = scaledWidth;
                    skySprite.height = scaledHeight;
                    skySprite.x = i * scaledWidth;
                    skySprite.y = 0;
                    skySprite.anchor.set(0, 0);

                    container.addChild(skySprite);
                }

                this.stage.addChild(container);
                this.parallaxLayers.push({
                    container,
                    speed: config.speed,
                    x: 0
                });
            }
            console.log(`✅ Created ${this.parallaxLayers.length} parallax layers`);
        } catch (error) {
            console.warn('⚠️ Failed to load sky background, using fallback:', error);
            // Fallback to solid blue background
            const fallbackBg = new Graphics();
            fallbackBg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            fallbackBg.fill({ color: 0x87ceeb });
            this.stage.addChild(fallbackBg);
        }
    }

    private drawBackground() {
        this.background.clear();
        // Only draw ground now, sky is handled by parallax
        this.background.rect(0, GAME_HEIGHT - 50, GAME_WIDTH, 50);
        this.background.fill({ color: 0x8b7355 });
    }

    private async drawPlayer(): Promise<Container> {
        const container = new Container();

        // Shadow beneath bird
        const shadow = new Graphics();
        shadow.circle(0, 8, 10);
        shadow.fill({ color: 0x000000, alpha: 0.3 });
        container.addChild(shadow);

        // Load and add bird sprite
        const texture = await Assets.load('/flappy-bird.png');
        const bird = new Sprite(texture);

        // Stretch to match hitbox
        bird.width = PLAYER_RADIUS * 2;
        bird.height = PLAYER_RADIUS * 2;

        // Center the sprite
        bird.anchor.set(0.5, 0.5);

        container.addChild(bird);

        container.position.set(PLAYER_X, this.playerY);

        // Make invisible initially - will be controlled by updateAllPlayers
        container.visible = false;

        return container;
    }

    private drawPipe(x: number, gapY: number): Container {
        const pipeContainer = new Container();

        // Shadow first (behind pipes)
        const shadow = new Graphics();
        shadow.rect(8, 8, PIPE_WIDTH, gapY);
        shadow.fill({ color: 0x000000, alpha: 0.2 });

        shadow.rect(
            8,
            gapY + PIPE_GAP,
            PIPE_WIDTH,
            GAME_HEIGHT - (gapY + PIPE_GAP)
        );
        shadow.fill({ color: 0x000000, alpha: 0.2 });

        // Main pipe graphics
        const pipeGraphics = new Graphics();

        // Top pipe with gradient effect (darker on right)
        pipeGraphics.rect(0, 0, PIPE_WIDTH, gapY);
        pipeGraphics.fill({ color: 0x228b22 });

        // Add highlight on left edge
        pipeGraphics.rect(0, 0, 8, gapY);
        pipeGraphics.fill({ color: 0x32cd32 });

        // Add shading on right edge
        pipeGraphics.rect(PIPE_WIDTH - 8, 0, 8, gapY);
        pipeGraphics.fill({ color: 0x1a6b1a });

        // Bottom pipe with same gradient effect
        pipeGraphics.rect(
            0,
            gapY + PIPE_GAP,
            PIPE_WIDTH,
            GAME_HEIGHT - (gapY + PIPE_GAP)
        );
        pipeGraphics.fill({ color: 0x228b22 });

        pipeGraphics.rect(0, gapY + PIPE_GAP, 8, GAME_HEIGHT - (gapY + PIPE_GAP));
        pipeGraphics.fill({ color: 0x32cd32 });

        pipeGraphics.rect(PIPE_WIDTH - 8, gapY + PIPE_GAP, 8, GAME_HEIGHT - (gapY + PIPE_GAP));
        pipeGraphics.fill({ color: 0x1a6b1a });

        // Pipe borders for depth
        pipeGraphics.rect(0, 0, PIPE_WIDTH, gapY);
        pipeGraphics.stroke({ color: 0x0d4f0d, width: 2 });

        pipeGraphics.rect(
            0,
            gapY + PIPE_GAP,
            PIPE_WIDTH,
            GAME_HEIGHT - (gapY + PIPE_GAP)
        );
        pipeGraphics.stroke({ color: 0x0d4f0d, width: 2 });

        pipeContainer.addChild(shadow);
        pipeContainer.addChild(pipeGraphics);
        pipeContainer.position.x = x;

        // Add to stage LATER to ensure it's on top
        this.stage.addChild(pipeContainer);

        return pipeContainer;
    }

    update() {
        // Update player position (use game coordinates consistently)
        this.playerY += this.playerVelocityY;

        this.playerContainer.position.set(PLAYER_X, this.playerY);

        // Update parallax scrolling
        this.updateParallax();

        // Note: Pipe movement is handled entirely by server via setPipes() to prevent conflicts
    }

    private updateParallax() {
        // Update game speed based on pipe movement
        this.gameSpeed = PIPE_SPEED;

        for (const layer of this.parallaxLayers) {
            layer.x -= this.gameSpeed * layer.speed;

            // Calculate actual sprite width for seamless scrolling
            const spriteWidth = GAME_WIDTH * layer.container.children[0].scale.x;

            // Reset position for seamless scrolling when first sprite goes off-screen
            if (layer.x <= -spriteWidth) {
                layer.x = 0;
            }

            layer.container.x = layer.x;
        }
    }

    applyGravity() {
        this.playerVelocityY += GRAVITY;
    }

    jump() {
        this.playerVelocityY = JUMP_POWER;
    }

    checkCollision(): boolean {
        // Ground collision (use GAME_HEIGHT consistently)
        if (this.playerY > GAME_HEIGHT - GROUND_HEIGHT - EFFECTIVE_RADIUS) {
            console.log('Ground collision! playerY:', this.playerY, 'ground:', GAME_HEIGHT - GROUND_HEIGHT);
            return true;
        }

        // Ceiling collision
        if (this.playerY < EFFECTIVE_RADIUS) {
            console.log('Ceiling collision! playerY:', this.playerY);
            return true;
        }

        // Pipe collision (use game coordinates consistently)
        for (const pipe of this.pipes) {
            // Debug: Show both coordinate systems
            console.log(`Collision check: Player at x=${PLAYER_X}, pipe visual at x=${pipe.container.position.x}, pipe data at x=${pipe.x}`);

            // Use container position for collision (visual position)
            const pipeX = pipe.container.position.x;

            if (
                PLAYER_X + EFFECTIVE_RADIUS > pipeX &&
                PLAYER_X - EFFECTIVE_RADIUS < pipeX + PIPE_WIDTH
            ) {
                if (this.playerY - EFFECTIVE_RADIUS < pipe.gapY || this.playerY + EFFECTIVE_RADIUS > pipe.gapY + PIPE_GAP) {
                    console.log('Pipe collision! playerY:', this.playerY, 'pipeX:', pipeX, 'pipeGapY:', pipe.gapY, 'pipeGapBottom:', pipe.gapY + PIPE_GAP);
                    return true;
                }
            }
        }

        return false;
    }

    getScore(): number {
        return this.score;
    }

    get playerPosition() {
        return { x: PLAYER_X, y: this.playerY };
    }

    setLocalPlayerId(playerId: string) {
        this.localPlayerId = playerId;
    }

    setPlayerY(y: number, alive: boolean = true) {
        // Server sends y in GAME_HEIGHT coords, use directly
        this.playerY = y;

        // Render player at server position (no scaling needed)
        this.playerContainer.position.set(PLAYER_X, y);

        // Hide player when dead
        this.playerContainer.visible = alive;
    }

    updateAllPlayers(serverPlayers: Array<{ id: string; name: string; y: number; score: number; alive: boolean }>) {
        // Update or create all players
        for (const serverPlayer of serverPlayers) {
            const isLocal = serverPlayer.id === this.localPlayerId;

            // Only log occasionally to reduce spam
      if (Math.random() < 0.01) { // 1% chance to log
        console.log(`Player ${serverPlayer.name} (${serverPlayer.id.substring(0, 6)}): isLocal=${isLocal}`);
      }

            // Render all players through the same system
            this.updateOrCreatePlayer(serverPlayer.id, serverPlayer.name, serverPlayer.y, serverPlayer.alive, isLocal);
        }

        // Remove players that are no longer in the game
        const currentPlayerIds = new Set(serverPlayers.map(p => p.id));
        for (const [playerId, player] of this.players.entries()) {
            if (!currentPlayerIds.has(playerId)) {
                this.removePlayer(playerId);
            }
        }
    }

    private async updateOrCreatePlayer(playerId: string, name: string, y: number, alive: boolean, isLocal: boolean) {
        if (!this.players.has(playerId)) {
            const container = new Container();

            // Name text above bird
            const nameText = new Text({
                text: name,
                style: {
                    fontFamily: 'Arial',
                    fontSize: 14,
                    fontWeight: 'bold',
                    fill: isLocal ? 0xFFFFFF : 0xFFFF00, // White for local, yellow for others
                    stroke: {
                        color: 0x000000,
                        width: 2
                    },
                    align: 'center'
                }
            });
            nameText.anchor.set(0.5, 0.5);
            nameText.y = -PLAYER_RADIUS - 15; // Position above bird
            container.addChild(nameText);

            // Shadow beneath bird
            const shadow = new Graphics();
            shadow.circle(0, 8, 10);
            shadow.fill({ color: 0x000000, alpha: 0.3 });
            container.addChild(shadow);

            // Load and add bird sprite
            const texture = await Assets.load('/flappy-bird.png');
            const bird = new Sprite(texture);

            bird.width = PLAYER_RADIUS * 2;
            bird.height = PLAYER_RADIUS * 2;
            bird.anchor.set(0.5, 0.5);

            container.addChild(bird);
            this.stage.addChild(container);

            this.players.set(playerId, {
                id: playerId,
                name: name,
                sprite: container,
                nameText: nameText,
                x: PLAYER_X,
                y: y,
                score: 0,
                alive
            });

            console.log(`Created player sprite for ${name} (${playerId.substring(0, 6)}), isLocal=${isLocal}`);
        }

        const player = this.players.get(playerId)!;
        player.y = y;
        player.alive = alive;

        // Position at same x as all players
        player.sprite.position.set(PLAYER_X, y);

        // Update name text visibility and alpha
        player.nameText.visible = alive;
        if (isLocal) {
            player.sprite.alpha = alive ? 1.0 : 0.5; // Full opacity for local player
            player.nameText.alpha = alive ? 1.0 : 0.5;
        } else {
            player.sprite.alpha = alive ? 0.5 : 0.25; // More visible for others
            player.nameText.alpha = alive ? 0.7 : 0.3;
        }
        player.sprite.visible = true;
    }


    setPipes(serverPipes: Array<{ x: number; gapY: number }>) {
        // Only rebuild pipe array if the count changed significantly
        if (Math.abs(serverPipes.length - this.pipes.length) > 1) {
            console.log(`🔄 Pipe count changed (${this.pipes.length} → ${serverPipes.length}), rebuilding`);
            this.rebuildPipes(serverPipes);
            return;
        }

        // Synchronize pipe positions - server is authoritative
        for (let i = 0; i < serverPipes.length; i++) {
            const serverPipe = serverPipes[i];

            if (i < this.pipes.length) {
                // Synchronize existing pipe with server position
                const existingPipe = this.pipes[i];
                const positionDiff = Math.abs(existingPipe.x - serverPipe.x);

                // Only update if position difference is significant (prevents jitter)
                if (positionDiff > 2) {
                    existingPipe.x = serverPipe.x;
                    existingPipe.container.position.x = serverPipe.x;
                }

                // Update gapY if changed
                if (existingPipe.gapY !== serverPipe.gapY) {
                    existingPipe.gapY = serverPipe.gapY;
                    // Recreate pipe with new gap position
                    this.stage.removeChild(existingPipe.container);
                    existingPipe.container = this.drawPipe(serverPipe.x, serverPipe.gapY);
                }
            } else {
                // Create new pipe when server sends new pipes
                const container = this.drawPipe(serverPipe.x, serverPipe.gapY);
                this.pipes.push({ x: serverPipe.x, gapY: serverPipe.gapY, container });
            }
        }

        // Remove excess pipes
        for (let i = this.pipes.length - 1; i >= serverPipes.length; i--) {
            this.stage.removeChild(this.pipes[i].container);
            this.pipes.splice(i, 1);
        }
    }

    private rebuildPipes(serverPipes: Array<{ x: number; gapY: number }>) {
        // Clear all existing pipes
        for (const pipe of this.pipes) {
            this.stage.removeChild(pipe.container);
        }
        this.pipes = [];

        // Create all new pipes
        for (let i = 0; i < serverPipes.length; i++) {
            const serverPipe = serverPipes[i];
            console.log(`Rebuilding pipe ${i}: x=${serverPipe.x}, gapY=${serverPipe.gapY}`);
            const container = this.drawPipe(serverPipe.x, serverPipe.gapY);
            this.pipes.push({ x: serverPipe.x, gapY: serverPipe.gapY, container });
        }
    }

  
    removePlayer(playerId: string) {
        const player = this.players.get(playerId);
        if (player) {
            this.stage.removeChild(player.sprite);
            this.players.delete(playerId);
        }
    }

    reset() {
        this.playerY = GAME_HEIGHT / 2;
        this.playerVelocityY = 0;
        this.pipes = [];
        this.pipeCounter = 0;
        this.score = 0;
        this.gameSpeed = 0;

        // Reset parallax positions
        for (const layer of this.parallaxLayers) {
            layer.x = 0;
            layer.container.x = 0;
        }

        // Clear pipes
        for (let i = this.stage.children.length - 1; i >= 2; i--) {
            this.stage.removeChildAt(i);
        }

        // Re-add players
        for (const player of this.players.values()) {
            this.stage.addChild(player.sprite);
        }
    }

    private calculateScale() {
        // Check if app and renderer still exist
        if (!this.app || !this.app.renderer) return;

        // Keep game at fixed dimensions, scale the canvas
        this.app.renderer.resize(GAME_WIDTH, GAME_HEIGHT);
        this.drawBackground();
    }

    private onResize() {
        this.calculateScale();
    }
}
