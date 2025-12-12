import { Application, Container, Graphics, Sprite, Assets, Text } from 'pixi.js';

interface Player {
    id: string;
    name: string;
    sprite: Container;
    nameText: any; // PIXI.Text
    birdSprite: Sprite; // The actual bird sprite to swap textures
    x: number;
    y: number;
    score: number;
    alive: boolean;
    skinId?: string;
    jumping?: boolean;
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
const PLAYER_RADIUS = 32;
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
    private spriteSheetLoaded: boolean = false;

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
        this.stage.sortableChildren = true; // Enable z-index sorting
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

        // Fixed desktop size - no scaling
        this.app.canvas.style.width = `${GAME_WIDTH}px`;
        this.app.canvas.style.height = `${GAME_HEIGHT}px`;
        this.app.canvas.style.display = 'block';

        this.app.stage.addChild(this.stage);

        // Load sprite sheet
        await this.loadSpriteSheet();

        // Create parallax background
        await this.createParallaxBackground();

        // Ground layer (on top of parallax)
        this.drawBackground();
        this.stage.addChild(this.background);

        // Player container (LEGACY - kept for compatibility but hidden in multiplayer mode)
        this.playerContainer = await this.drawPlayer();
        this.playerContainer.visible = false; // Hide legacy container - using multiplayer system now
        this.stage.addChild(this.playerContainer);
    }

    private async loadSpriteSheet() {
        try {
            console.log('🎨 Loading sprite sheet...');
            await Assets.load('/sprites.json');
            this.spriteSheetLoaded = true;
            console.log('✅ Sprite sheet loaded successfully');
        } catch (error) {
            console.warn('⚠️ Sprite sheet not found, using fallback flappy-bird.png:', error);
            this.spriteSheetLoaded = false;
        }
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

    private updatePlayerTexture(player: Player) {
        if (!this.spriteSheetLoaded) {
            console.warn(`⚠️ Sprite sheet not loaded, cannot update texture`);
            return;
        }

        const baseSkin = player.skinId || 'character1';
        const frameName = player.jumping ? `${baseSkin}-boosting` : `${baseSkin}-idle`;

        console.log(`🎬 Updating texture: jumping=${player.jumping}, frameName=${frameName}`);

        try {
            const spriteSheet = Assets.cache.get('/sprites.json');
            if (spriteSheet?.textures?.[frameName]) {
                player.birdSprite.texture = spriteSheet.textures[frameName];
                console.log(`✅ Texture updated to ${frameName}`);
            } else {
                console.warn(`⚠️ Frame ${frameName} not found in sprite sheet. Available:`, Object.keys(spriteSheet?.textures || {}));
            }
        } catch (error) {
            console.warn(`❌ Failed to update texture to ${frameName}:`, error);
        }
    }

    setLocalPlayerId(playerId: string) {
        console.log(`🎯 setLocalPlayerId called: ${playerId?.substring(0, 6)}`);
        this.localPlayerId = playerId;

        // If player sprite already exists, update its visual style to local
        if (this.players.has(playerId)) {
            console.log(`⚠️ Player sprite already exists for ${playerId.substring(0, 6)}, updating to LOCAL style`);
            const player = this.players.get(playerId)!;
            player.sprite.alpha = player.alive ? 1.0 : 0.5;
            player.nameText.alpha = player.alive ? 1.0 : 0.5;
            player.nameText.style.fill = 0xFFFFFF; // White for local
        }
    }

    setPlayerY(y: number, alive: boolean = true) {
        // LEGACY - only used by old HostGame.tsx
        // Server sends y in GAME_HEIGHT coords, use directly
        this.playerY = y;

        // Render player at server position (no scaling needed)
        this.playerContainer.position.set(PLAYER_X, y);

        // KEEP INVISIBLE - using multiplayer system (updateAllPlayers) instead
        // This legacy container should never be visible
        this.playerContainer.visible = false;
    }

    updateAllPlayers(serverPlayers: Array<{ id: string; name: string; y: number; score: number; alive: boolean; skinId?: string; jumping?: boolean }>) {
        console.log(`📊 updateAllPlayers called with ${serverPlayers.length} players:`, serverPlayers.map(p => `${p.name}(${p.id.substring(0,6)}) skinId=${p.skinId} jumping=${p.jumping}`));
        console.log(`   🎯 localPlayerId = ${this.localPlayerId?.substring(0, 6)}`);
        console.log(`   📦 Current players in map: ${this.players.size}`, Array.from(this.players.keys()).map(id => id.substring(0, 6)));

        // Update or create all players
        for (const serverPlayer of serverPlayers) {
            const isLocal = serverPlayer.id === this.localPlayerId;

            console.log(`👤 Processing player ${serverPlayer.name} (${serverPlayer.id.substring(0, 6)}): isLocal=${isLocal}, skinId=${serverPlayer.skinId}, jumping=${serverPlayer.jumping}`);

            // Render all players through the same system
            this.updateOrCreatePlayer(serverPlayer.id, serverPlayer.name, serverPlayer.y, serverPlayer.alive, isLocal, serverPlayer.skinId, serverPlayer.jumping);
        }

        // Remove players that are no longer in the game
        const currentPlayerIds = new Set(serverPlayers.map(p => p.id));
        for (const [playerId, player] of this.players.entries()) {
            if (!currentPlayerIds.has(playerId)) {
                this.removePlayer(playerId);
            }
        }
    }

    private async updateOrCreatePlayer(playerId: string, name: string, y: number, alive: boolean, isLocal: boolean, skinId?: string, jumping?: boolean) {
        // Check again after any pending async operations, to prevent race condition
        if (this.players.has(playerId)) {
            // Player already exists, just update it
            const player = this.players.get(playerId)!;

            // Check if skin changed - recreate sprite if needed
            if (skinId && player.skinId !== skinId) {
                console.log(`🎨 Skin changed for ${name}: ${player.skinId} -> ${skinId}, recreating sprite`);
                this.removePlayer(playerId);
                // Will be recreated below
            } else {
                player.y = y;
                player.alive = alive;
                player.jumping = jumping;
                player.sprite.position.set(PLAYER_X, y);
                player.nameText.visible = alive;

                // Update texture based on jumping state
                this.updatePlayerTexture(player);

                if (isLocal) {
                    player.sprite.alpha = alive ? 1.0 : 0.5;
                    player.nameText.alpha = alive ? 1.0 : 0.5;
                } else {
                    player.sprite.alpha = alive ? 0.5 : 0.25;
                    player.nameText.alpha = alive ? 0.7 : 0.3;
                }
                player.sprite.visible = true;
                return;
            }
        }

        console.log(`🆕 Creating NEW player sprite: ${name} (${playerId.substring(0, 6)}), isLocal=${isLocal}, skinId=${skinId}, total players before: ${this.players.size}`);
        console.log(`   Current players in map:`, Array.from(this.players.keys()).map(id => id.substring(0, 6)));

        // Add placeholder immediately to prevent duplicate creation during async texture load
        const placeholderNameText = new Text({
            text: name,
            style: {
                fontFamily: 'Arial',
                fontSize: 14,
                fontWeight: 'bold',
                fill: isLocal ? 0xFFFFFF : 0xFFFF00, // Set correct color immediately
                stroke: {
                    color: 0x000000,
                    width: 2
                }
            }
        });

        this.players.set(playerId, {
            id: playerId,
            name: name,
            sprite: new Container(), // Temporary
            nameText: placeholderNameText,
            birdSprite: new Sprite(), // Temporary
            x: PLAYER_X,
            y: y,
            score: 0,
            alive,
            skinId: skinId || 'character1',
            jumping: jumping || false
        });

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

        // Load and add bird sprite based on skinId
        let texture;
        const frameName = skinId || 'character1';
        console.log(`🎨 Loading skin ${frameName} for player ${name}, spriteSheetLoaded=${this.spriteSheetLoaded}`);

        if (this.spriteSheetLoaded) {
            try {
                const spriteSheet = Assets.cache.get('/sprites.json');
                if (spriteSheet?.textures?.[frameName]) {
                    texture = spriteSheet.textures[frameName];
                    console.log(`✅ Loaded ${frameName} from sprite sheet`);
                } else {
                    console.warn(`⚠️ Frame ${frameName} not in sprite sheet, using flappy-bird.png`);
                    texture = await Assets.load('/flappy-bird.png');
                }
            } catch (error) {
                console.warn(`⚠️ Error loading sprite sheet frame, using flappy-bird.png:`, error);
                texture = await Assets.load('/flappy-bird.png');
            }
        } else {
            // Fallback to flappy-bird.png
            console.log(`Using fallback flappy-bird.png`);
            texture = await Assets.load('/flappy-bird.png');
        }

        const bird = new Sprite(texture);

        bird.width = PLAYER_RADIUS * 2;
        bird.height = PLAYER_RADIUS * 2;
        bird.anchor.set(0.5, 0.5);
        bird.alpha = 1.0; // Ensure bird sprite itself is fully opaque

        container.addChild(bird);

        container.alpha = 1.0; // Ensure container is fully opaque

        // Add container to stage - ensure it's above background layers
        // Background is at index 0, parallax layers follow, then ground
        // Players should be on top
        this.stage.addChild(container);

        // Force player sprites to render on top by setting higher zIndex
        container.zIndex = 1000;
        this.stage.sortChildren();

        // Update the placeholder with the real sprite
        const playerData = this.players.get(playerId)!;
        playerData.sprite = container;
        playerData.nameText = nameText;
        playerData.birdSprite = bird;

        console.log(`Created player sprite for ${name} (${playerId.substring(0, 6)}), isLocal=${isLocal}`);

        // Update the newly created player's visual state
        playerData.y = y;
        playerData.alive = alive;
        playerData.sprite.position.set(PLAYER_X, y);
        playerData.nameText.visible = alive;

        if (isLocal) {
            playerData.sprite.alpha = alive ? 1.0 : 0.5;
            playerData.nameText.alpha = alive ? 1.0 : 0.5;
            console.log(`🎨 Created LOCAL player - sprite alpha: ${playerData.sprite.alpha}, name color: ${playerData.nameText.style.fill}`);
            console.log(`   Container world alpha: ${playerData.sprite.worldAlpha}`);
            console.log(`   Container visible: ${playerData.sprite.visible}`);
            console.log(`   Container position: x=${playerData.sprite.x}, y=${playerData.sprite.y}`);
            console.log(`   Total stage children: ${this.stage.children.length}`);
            // Check individual children alphas
            playerData.sprite.children.forEach((child: any, i: number) => {
                console.log(`   Child ${i} (${child.constructor.name}): alpha=${child.alpha}, worldAlpha=${child.worldAlpha}, visible=${child.visible}`);
            });
        } else {
            playerData.sprite.alpha = alive ? 0.5 : 0.25;
            playerData.nameText.alpha = alive ? 0.7 : 0.3;
            console.log(`👻 Created GHOST player - sprite alpha: ${playerData.sprite.alpha}, name color: ${playerData.nameText.style.fill}`);
        }
        playerData.sprite.visible = true;
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
        console.log('🔄 Resetting renderer');
        console.log(`   Current localPlayerId: ${this.localPlayerId?.substring(0, 6)}`);
        console.log(`   Current players before clear:`, Array.from(this.players.keys()).map(id => id.substring(0, 6)));

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

        // Clear ALL children except background and parallax (index 0 and 1)
        // This removes pipes AND players
        for (let i = this.stage.children.length - 1; i >= 2; i--) {
            this.stage.removeChildAt(i);
        }

        // Clear players map completely - they'll be recreated when updateAllPlayers is called
        console.log(`🗑️ Clearing ${this.players.size} player sprites`);
        this.players.clear();
        console.log(`   ✅ Reset complete, localPlayerId still: ${this.localPlayerId?.substring(0, 6)}`);
    }

}
