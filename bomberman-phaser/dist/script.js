'use strict';

// Sistema de Som
class SoundManager {
  constructor() {
    this.audioContext = null;
    this.masterVolume = 0.3;
    this.init();
  }

  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Web Audio API não suportado');
    }
  }

  // Som de plantar bomba - "tick" metálico
  playBombPlant() {
    if (!this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Frequência alta e rápida para simular "tick"
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(this.masterVolume * 0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
    
    oscillator.type = 'square';
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Som de explosão - "boom" profundo
  playExplosion() {
    if (!this.audioContext) return;
    
    // Criamos múltiplos osciladores para um som mais rico
    const oscillators = [];
    const gainNodes = [];
    
    // Som grave de base
    for (let i = 0; i < 3; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      // Frequências diferentes para riqueza sonora
      const baseFreq = 60 + (i * 20);
      osc.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.5);
      
      gain.gain.setValueAtTime(this.masterVolume * 0.4, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      osc.type = i === 0 ? 'sawtooth' : 'square';
      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.5);
      
      oscillators.push(osc);
      gainNodes.push(gain);
    }

    // Ruído branco para o "crack" da explosão
    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.3;
    }
    
    const whiteNoise = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();
    
    whiteNoise.buffer = buffer;
    whiteNoise.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);
    
    noiseGain.gain.setValueAtTime(this.masterVolume * 0.2, this.audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
    
    whiteNoise.start(this.audioContext.currentTime);
  }
}

// Instância global do som
const gameSound = new SoundManager();

class Entity extends Phaser.Sprite {
  constructor(game, x, y, grid, index = 0) {
    super(game, x, y, 'sprites', index);
    this.anchor.setTo(.5);
    this.game.physics.arcade.enable(this);
    this.grid = grid;
    this.grid.add(this);
    if (this.gridPos) {
      this.grid.screenToGrid(this.x, this.y, this.gridPos);
    }
  }

  destroy() {
    this.grid.remove(this);
    super.destroy();
  }

  kill() {
    super.kill();
  }
}

class Wall extends Entity {
  constructor(game, x, y, grid) {
    super(game, x, y, grid, 0);
    this.body.moves = false;
    this.body.immovable = true;
    this.slack = 0.5;
    this.body.setSize(32 - this.slack, 32 - this.slack, this.slack * 0.5, this.slack * 0.5)
    this.tint = 0x404040; // Cinza escuro
  }
  
  kill() {
    // cannot be killed
  }
}

class Bricks extends Wall {
  constructor(game, x, y, grid) {
    super(game, x, y, grid);
    this.frame = 1;
    this.tint = 0x8B4513; // Marrom
  }
  
  kill() {
    const pickupChance = this.game.rnd.frac();
    const tween = this.game.add.tween(this).to({alpha: 0}, 300, Phaser.Easing.Linear.None, true);
    
    tween.onComplete.add(() => {
      this.destroy();
    }, this);
    
    // 1/2 chance of dropping a power-up for more action!
    if (pickupChance < 0.5) {
      this.dropPickup();
    }
  }
  
  dropPickup() {
    const place = this.gridPos.clone();
    const screenPos = this.grid.gridToScreen(place.x, place.y);
    
    const pickupClasses = [PickupBomb, PickupFire, PickupSpeed];
    const pickupClass = this.game.rnd.pick(pickupClasses);
    
    const pickup = new (pickupClass)(this.game, screenPos.x, screenPos.y, this.grid);
    
    this.parent.add(pickup);
  }
}

class Player extends Entity {
  constructor(game, x, y, grid, spriteFrame = 6) {
    super(game, x, y, grid, spriteFrame);

    this.controls = this.game.input.keyboard.createCursorKeys();
    this.speed = 120;
    this.maxSpeed = 320; // Velocidade máxima permitida

    this.totalBombs = 1;
    this.currentBombs = 0;
    this.bombSize = 3;

    this.body.setCircle(16);
    this.body.drag.set(768);

    this.lastGridPos = this.gridPos.clone();
    
    this.blastThrough = true;
    
    // Bomba da qual o jogador pode escapar mesmo com colisão
    this.escapeBomb = null;
  }

  update() {
    super.update();
    if (!this.alive) {
      return;
    }
    if (this.controls.up.isDown) {
      this.body.velocity.y = this.speed * -1;
    }
    else if (this.controls.down.isDown) {
      this.body.velocity.y = this.speed;
    }

    if (this.controls.left.isDown) {
      this.body.velocity.x = this.speed * -1;
    }
    else if (this.controls.right.isDown) {
      this.body.velocity.x = this.speed;
    }

    if (this.game.input.keyboard.justPressed(Phaser.Keyboard.SPACEBAR)) {
      this.dropBomb();
    }
    if (this.gridPos) {
      this.grid.screenToGrid(this.x, this.y, this.gridPos);
    }

    if (!this.gridPos.equals(this.lastGridPos)) {
      this.lastGridPos.copyFrom(this.gridPos);
      this.checkGrid();
    }
  }

  kill() {
    this.body.moves = false;
    super.kill();
  }

  canPlaceBomb(place) {
    return !this.grid.getAt(place.x, place.y, this);
  }

  dropBomb() {    
    const place = this.gridPos.clone();
    const screenPos = this.grid.gridToScreen(place.x, place.y);
    if (this.currentBombs < this.totalBombs && this.canPlaceBomb(place)) {
      // Toca som de plantar bomba
      gameSound.playBombPlant();
      
      const bomb = new Bomb(this.game, screenPos.x, screenPos.y, this.grid, this);
      this.parent.add(bomb);
      
      // Define esta bomba como escapeBomb para permitir escape inicial
      this.escapeBomb = bomb;
      
      if (this instanceof Bot) {
        const originalDestroy = bomb.destroy.bind(bomb);
        bomb.destroy = () => {
          // Reset estado wait quando bomba explode
          this.wait = false;
          // Remove referência da escapeBomb quando explode
          if (this.escapeBomb === bomb) {
            this.escapeBomb = null;
          }
          originalDestroy();
        };
      } else {
        // Para jogadores humanos também remove escapeBomb
        const originalDestroy = bomb.destroy.bind(bomb);
        bomb.destroy = () => {
          if (this.escapeBomb === bomb) {
            this.escapeBomb = null;
          }
          originalDestroy();
        };
      }
    }
  }
  
  checkGrid() {
    const item = this.grid.getAt(this.gridPos.x, this.gridPos.y, this);
    if (item && item instanceof Pickup) {
      item.collect(this);
    }
    
    // Check if player has left their escape bomb
    if (this.escapeBomb) {
      const bombGridPos = new Phaser.Point();
      this.grid.screenToGrid(this.escapeBomb.x, this.escapeBomb.y, bombGridPos);
      if (!this.gridPos.equals(bombGridPos)) {
        // Player has left the bomb, can no longer walk through it
        this.escapeBomb = null;
      }
    }
  }
}

class Bot extends Player {
  constructor(game, x, y, grid, botId = 0) {
    super(game, x, y, grid, 6);
    
    this.controls = null;
    this.botId = botId;
    
    // Sistema de estados exato do bomberman verde original
    this.AI_STATES = {
      THINK: 'think',
      ITEM: 'item', 
      DEFEND: 'defend'
    };
    
    this.currentState = this.AI_STATES.THINK;
    this.stopTimeLeft = 2.0; // Delay inicial exato do original
    this.moveTimeLeft = 0.0;
    
    // Sistema de pontuação BURN_MARK EXATO do bomberman verde
    this.BURN_MARK = [
      [0, 0, 0, 0, 0, 0],        // 0 paredes destruíveis
      [10, 8, 5, 3, 2, 1],       // 1 parede destruível  
      [20, 17, 15, 12, 10, 5],   // 2 paredes destruíveis
      [30, 26, 24, 22, 15, 10]   // 3 paredes destruíveis
    ];
    
    this.AI_VIEW_SIZE = 12; // Tamanho da visão da IA aumentada
    this.itemGoal = null;
    this.itemDropBomb = false;
    this.dangerPositions = [];
    this.tilesInRange = [];
    
    // Configurações do bot
    this.speed = 120;
    this.totalBombs = 1;
    this.bombsMax = 1;
    
    // Sistema de movimento suave tile-by-tile
    this.targetPosition = { x: this.gridPos.x, y: this.gridPos.y };
    this.isMoving = false;
    this.moveDirection = { x: 0, y: 0 };
    this.moveStartTime = 0;
    this.moveDuration = 0;
    this.moveStartPos = { x: this.x, y: this.y };
    this.moveTargetPos = { x: this.x, y: this.y };
    
    this.setBotTint();
  }

  kill() {
    super.kill();
    
    // Verifica quantos bots ainda estão vivos
    const aliveBots = this.game.state.states.Level.bots.filter(bot => bot.alive);
    
    if (aliveBots.length === 1) {
      // Só resta 1 bot - declarar vitória
      this.game.state.states.Level.showVictory(aliveBots[0]);
    }
  }

  setBotTint() {
    const tints = [
      0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 
      0xff44ff, 0x44ffff, 0xff8844, 0x88ff44,
      0xff4488, 0x8844ff, 0x44ff88, 0xffffff
    ];
    if (this.botId < tints.length) {
      this.tint = tints[this.botId];
    }
  }

  // Sistema de estados exato do bomberman verde original
  setBotMode(mode) {
    if (mode === this.AI_STATES.THINK) {
      switch (this.currentState) {
        case this.AI_STATES.ITEM: 
          this.stopTimeLeft = 0.08 + (Math.random() * 40) / 1000; 
          break;
        case this.AI_STATES.DEFEND: 
          this.stopTimeLeft = 0.12 + (Math.random() * 40) / 1000; 
          break;
        default:
          this.stopTimeLeft = 0.22 + (Math.random() * 40) / 1000;
          break;
      }
    }
    this.currentState = mode;
  }

  update() {
    if (!this.alive) {
      return;
    }

    // Atualiza dados de contexto da IA
    this.updateAIContext();

    // Sistema de timing EXATO do bomberman verde original
    if (this.stopTimeLeft <= 0) {
      // Só toma decisões quando não está se movendo ou quando moveTimeLeft expira
      if (this.moveTimeLeft <= 0 && !this.isMoving) {
        
        // Executa lógica de pensamento
        if (this.currentState === this.AI_STATES.THINK) {
          this.modeThink();
        }
        
        // Executa ação baseada no estado atual
        switch (this.currentState) {
          case this.AI_STATES.ITEM:
            this.modeItem();
            break;
          case this.AI_STATES.DEFEND:
            this.modeDefend();
            break;
        }
      }
      
      // Sempre processa movimento suave
      this.processMovement();
      this.processAction();
      
      // Decrementa timer de movimento apenas se não está em movimento suave
      if (!this.isMoving) {
        this.moveTimeLeft -= this.game.time.physicsElapsed;
      }
      
    } else {
      // Para durante o delay (comportamento original)
      if (!this.isMoving) {
        this.body.velocity.x = 0;
        this.body.velocity.y = 0;
      } else {
        // Continua movimento suave mesmo durante delay
        this.processMovement();
      }
      this.stopTimeLeft -= this.game.time.physicsElapsed;
    }

    // Atualiza posição no grid
    this.updateGridPosition();
  }

  // Lógica de pensamento EXATA do bomberman verde original
  modeThink() {
    // SETUP - prepara variáveis
    let bestLocation = null;
    let bestScore = 0;

    // DEFEND - verifica se está em perigo 
    if (this.isInDanger(this.gridPos)) {
      this.setBotMode(this.AI_STATES.DEFEND);
      return;
    }

    // ATTACK - procura inimigos próximos para atacar
    const nearbyEnemy = this.findNearbyEnemyToAttack();
    if (nearbyEnemy) {
      this.itemGoal = nearbyEnemy;
      this.itemDropBomb = true;
      this.setBotMode(this.AI_STATES.ITEM);
      return;
    }

    // BOMB - encontra a melhor posição para bomba usando BURN_MARK
    this.tilesInRange = this.getTilesInRange(this.gridPos, this.AI_VIEW_SIZE);
    
    for (let i = 0; i < this.tilesInRange.length; i++) {
      const tile = this.tilesInRange[i];
      const pathLength = this.findPathLength(tile);
      const nearSoftWalls = this.getNearSoftWalls(tile);
      
      if (
        nearSoftWalls > 0 &&
        pathLength !== -1 &&
        pathLength < this.AI_VIEW_SIZE &&
        !this.isInDanger(tile) &&
        this.canDropBombAt(tile)
      ) {
        // Calcula pontuação usando BURN_MARK
        const currentScore = this.BURN_MARK[Math.min(nearSoftWalls, 3)][Math.min(pathLength, 5)];
        
        if (
          bestScore < currentScore ||
          (bestScore === currentScore && Math.random() >= 0.5)
        ) {
          bestLocation = tile;
          bestScore = currentScore;
        }
      }
    }

    // Se encontrou uma boa posição, vai para o modo ITEM
    if (bestScore > 0) {
      this.itemGoal = bestLocation;
      this.itemDropBomb = true;
      this.setBotMode(this.AI_STATES.ITEM);
      return;
    }

    // SEARCH - se não há objetivos próximos, procura ativamente
    const searchTarget = this.findSearchTarget();
    if (searchTarget) {
      this.itemGoal = searchTarget;
      this.itemDropBomb = false;
      this.setBotMode(this.AI_STATES.ITEM);
      return;
    }
  }

  // Modo ITEM exato do bomberman verde original
  modeItem() {
    // Reset bot commands
    this.body.velocity.x = 0;
    this.body.velocity.y = 0;

    // Se inimigo próximo e pode plantar bomba, talvez plante (70% chance)
    if ((
      this.isEnemyNearAndFront() &&
      this.canDropBombAt(this.gridPos) &&
      Math.random() < 0.7
    ) || (
      this.itemDropBomb &&
      !this.canDropBombAt(this.gridPos)
    )) {
      this.setBotMode(this.AI_STATES.THINK);
      return;
    }

    let goalReached = false;

    if (this.findPathLength(this.itemGoal) >= 0) {
      goalReached = this.goto(this.itemGoal);
    } else {
      // Não consegue mais chegar ao destino
      this.setBotMode(this.AI_STATES.THINK);
      return;
    }

    if (goalReached && this.itemDropBomb && this.currentBombs < this.totalBombs) {
      // Chegou ao objetivo e quer plantar bomba
      this.dropBomb();
      this.itemGoal = this.gridPos;
      this.itemDropBomb = false;
    } else if (goalReached && !this.itemDropBomb) {
      // Chegou ao objetivo mas não quer plantar bomba
      this.setBotMode(this.AI_STATES.THINK);
    }
  }

  // Modo DEFEND exato do bomberman verde original  
  modeDefend() {
    if (!this.isInDanger(this.gridPos)) {
      // Não está mais em perigo
      this.body.velocity.x = 0;
      this.body.velocity.y = 0;
      this.setBotMode(this.AI_STATES.THINK);
      return;
    }

    // Há perigo... encontra o melhor lugar seguro
    let found = false;
    let bestLocation = null;
    let bestDistance = 999;

    const tiles = this.getTilesInRange(this.gridPos, this.AI_VIEW_SIZE);
    for (let tile of tiles) {
      const pathLength = this.findPathLength(tile);

      if (
        pathLength !== -1 && // Acessível
        !this.isInDanger(tile) && // Não está em perigo
        (
          pathLength < bestDistance || // Mais próximo
          (pathLength === bestDistance && Math.random() >= 0.5) // Mesma distância, 50/50
        )
      ) {
        found = true;
        bestLocation = tile;
        bestDistance = pathLength;
      }
    }

    if (found) {
      // Encontrou local seguro, vai para lá
      this.goto(bestLocation);
    } else {
      // Não encontrou nada, para
      this.body.velocity.x = 0;
      this.body.velocity.y = 0;
      this.moveTimeLeft = 0;
    }
  }

  // Método goto com movimento suave tile-by-tile 
  goto(location) {
    // Se já está na localização de destino
    if (this.gridPos.x === location.x && this.gridPos.y === location.y) {
      this.body.velocity.x = 0;
      this.body.velocity.y = 0;
      this.isMoving = false;
      return true;
    }

    // Se não está se movendo, inicia novo movimento
    if (!this.isMoving) {
      const path = this.findPath(this.gridPos, location);
      if (path && path.length > 1) {
        const nextStep = path[1]; // Próximo tile para o destino
        this.startSmoothMovement(nextStep);
      } else {
        // Não há caminho válido
        this.body.velocity.x = 0;
        this.body.velocity.y = 0;
        return false;
      }
    }

    // Atualiza movimento suave
    this.updateSmoothMovement();

    // Retorna se chegou ao destino final
    return this.gridPos.x === location.x && this.gridPos.y === location.y;
  }

  // Inicia movimento suave para próximo tile
  startSmoothMovement(targetGridPos) {
    if (this.isMoving) return; // Já está se movendo

    this.targetPosition = { x: targetGridPos.x, y: targetGridPos.y };
    this.moveDirection = {
      x: targetGridPos.x - this.gridPos.x,
      y: targetGridPos.y - this.gridPos.y
    };

    // Calcula posições de tela
    this.moveStartPos = { x: this.x, y: this.y };
    this.moveTargetPos = this.grid.gridToScreen(targetGridPos.x, targetGridPos.y);
    
    // Tempo para mover um tile (baseado na velocidade)
    this.moveDuration = this.grid.size / this.speed; // segundos para cruzar um tile
    this.moveStartTime = this.game.time.now;
    this.moveTimeLeft = this.moveDuration;
    
    this.isMoving = true;
  }

  // Atualiza movimento suave
  updateSmoothMovement() {
    if (!this.isMoving) {
      this.body.velocity.x = 0;
      this.body.velocity.y = 0;
      return;
    }

    const elapsed = (this.game.time.now - this.moveStartTime) / 1000; // em segundos
    const progress = Math.min(elapsed / this.moveDuration, 1.0);

    // Interpolação linear entre posição inicial e final
    const currentX = this.moveStartPos.x + (this.moveTargetPos.x - this.moveStartPos.x) * progress;
    const currentY = this.moveStartPos.y + (this.moveTargetPos.y - this.moveStartPos.y) * progress;

    // Define posição atual
    this.x = currentX;
    this.y = currentY;

    // Define velocidade visual para animação
    this.body.velocity.x = this.moveDirection.x * this.speed;
    this.body.velocity.y = this.moveDirection.y * this.speed;

    // Verifica se completou o movimento
    if (progress >= 1.0) {
      // Movimento completado - alinha perfeitamente ao grid
      this.x = this.moveTargetPos.x;
      this.y = this.moveTargetPos.y;
      this.body.velocity.x = 0;
      this.body.velocity.y = 0;
      
      // Atualiza posição no grid
      this.gridPos.x = this.targetPosition.x;
      this.gridPos.y = this.targetPosition.y;
      
      this.isMoving = false;
      this.moveTimeLeft = 0;
    }
  }

  // Métodos auxiliares da IA do bomberman verde original

  updateAIContext() {
    // Atualiza dados de contexto da IA
    this.tilesInRange = this.getTilesInRange(this.gridPos, this.AI_VIEW_SIZE);
    this.dangerPositions = this.getDangerPositions();
    
    // Atualiza posição no grid
    if (this.gridPos) {
      this.grid.screenToGrid(this.x, this.y, this.gridPos);
    }
    if (!this.gridPos.equals(this.lastGridPos)) {
      this.lastGridPos.copyFrom(this.gridPos);
    }
  }

  updateGridPosition() {
    // Checa pickups
    this.checkGrid();
  }

  processMovement() {
    // Atualiza movimento suave se estiver em progresso
    if (this.isMoving) {
      this.updateSmoothMovement();
    }
  }

  processAction() {
    // Ações já são controladas pelos estados individuais
  }

  // Obtém tiles em um raio específico
  getTilesInRange(center, range) {
    const tiles = [];
    for (let x = Math.max(0, center.x - range); x <= Math.min(this.grid.width - 1, center.x + range); x++) {
      for (let y = Math.max(0, center.y - range); y <= Math.min(this.grid.height - 1, center.y + range); y++) {
        if (Math.abs(x - center.x) + Math.abs(y - center.y) <= range) {
          tiles.push({ x: x, y: y });
        }
      }
    }
    return tiles;
  }

  // Obtém posições de perigo de bombas ativas
  getDangerPositions() {
    const dangerPositions = [];
    for (const item of this.grid.items) {
      if (item instanceof Bomb) {
        const bombDanger = this.getBombDangerPositions(item);
        dangerPositions.push(...bombDanger);
      }
    }
    return dangerPositions;
  }

  // Método para obter posições de perigo de uma bomba (como no bomberman verde)
  getBombDangerPositions(bomb) {
    const dangerPositions = [];
    const bombPos = bomb.gridPos;
    const range = bomb.size || 3;

    // Adiciona a posição da própria bomba
    dangerPositions.push({ x: bombPos.x, y: bombPos.y });

    // Verifica em todas as 4 direções
    const directions = [
      { x: 1, y: 0 },   // direita
      { x: -1, y: 0 },  // esquerda
      { x: 0, y: 1 },   // baixo
      { x: 0, y: -1 }   // cima
    ];

    for (const dir of directions) {
      for (let distance = 1; distance < range; distance++) {
        const checkPos = {
          x: bombPos.x + (dir.x * distance),
          y: bombPos.y + (dir.y * distance)
        };

        // Verifica se há parede que bloqueia a explosão
        const item = this.grid.getAt(checkPos.x, checkPos.y);
        if (item && (item instanceof Wall || item instanceof Bricks)) {
          break; // Para de expandir nesta direção
        }

        dangerPositions.push({ x: checkPos.x, y: checkPos.y });
      }
    }

    return dangerPositions;
  }

  // Verifica se posição está em perigo
  isInDanger(position) {
    for (const dangerPos of this.getDangerPositions()) {
      if (dangerPos.x === position.x && dangerPos.y === position.y) {
        return true;
      }
    }
    return false;
  }

  // Conta paredes macias próximas
  getNearSoftWalls(position) {
    let count = 0;
    const directions = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    for (const dir of directions) {
      const checkPos = { x: position.x + dir.x, y: position.y + dir.y };
      const item = this.grid.getAt(checkPos.x, checkPos.y);
      if (item && item instanceof Bricks) {
        count++;
      }
    }
    return Math.min(count, 3); // Máximo 3 para BURN_MARK
  }
  
  // Pathfinding que respeita obstáculos
  findPath(start, end) {
    // Se start e end são iguais, retorna caminho vazio
    if (start.x === end.x && start.y === end.y) {
      return [{ x: start.x, y: start.y }];
    }

    // Verifica se o destino é acessível
    if (!this.isValidPosition(end)) {
      return null;
    }

    // Implementação básica de pathfinding que evita obstáculos
    const path = [{ x: start.x, y: start.y }];
    let current = { x: start.x, y: start.y };
    
    // Tenta mover em direção ao objetivo, verificando obstáculos
    let attempts = 0;
    const maxAttempts = 50; // Evita loops infinitos
    
    while ((current.x !== end.x || current.y !== end.y) && attempts < maxAttempts) {
      attempts++;
      let nextPos = { x: current.x, y: current.y };
      
      // Decide próximo movimento baseado na distância
      if (current.x < end.x) {
        nextPos.x++;
      } else if (current.x > end.x) {
        nextPos.x--;
      } else if (current.y < end.y) {
        nextPos.y++;
      } else if (current.y > end.y) {
        nextPos.y--;
      }
      
      // Verifica se a próxima posição é válida
      if (this.isValidPosition(nextPos)) {
        current = nextPos;
        path.push({ x: current.x, y: current.y });
      } else {
        // Se não pode mover diretamente, tenta direções alternativas
        const directions = [
          { x: 0, y: 1 }, { x: 0, y: -1 },
          { x: 1, y: 0 }, { x: -1, y: 0 }
        ];
        
        let moved = false;
        for (const dir of directions) {
          const altPos = { 
            x: current.x + dir.x, 
            y: current.y + dir.y 
          };
          
          if (this.isValidPosition(altPos)) {
            current = altPos;
            path.push({ x: current.x, y: current.y });
            moved = true;
            break;
          }
        }
        
        if (!moved) {
          // Não consegue mover, retorna caminho inválido
          return null;
        }
      }
    }
    
    return attempts >= maxAttempts ? null : path;
  }

  // Verifica se uma posição é válida para movimento
  isValidPosition(pos) {
    // Verifica limites do grid
    if (pos.x < 0 || pos.x >= this.grid.width || pos.y < 0 || pos.y >= this.grid.height) {
      return false;
    }

    const item = this.grid.getAt(pos.x, pos.y, this);
    
    // Não pode passar por paredes, tijolos ou bombas (exceto a própria bomba de escape)
    if (item && (item instanceof Wall || item instanceof Bricks)) {
      return false;
    }
    
    if (item instanceof Bomb) {
      // Allow passing through only if it's the player's own escape bomb
      if (item === this.escapeBomb) {
        return true;
      }
      // Block all other bombs (enemy bombs and own bombs after leaving them)
      return false;
    }
    
    // Não pode passar por explosões ativas
    if (item instanceof Blast || item instanceof Explosion) {
      return false;
    }
    
    // Pode passar por posições vazias, pickups ou outros bots
    return true;
  }

  findPathLength(destination) {
    const path = this.findPath(this.gridPos, destination);
    return path ? path.length - 1 : -1;
  }

  // Verifica se pode plantar bomba em posição exato do bomberman verde
  canDropBombAt(position) {
    // Verifica se pode acessar a posição
    if (this.findPathLength(position) < 0) {
      return false;
    }
    
    // Verifica se já tem bomba na posição
    const item = this.grid.getAt(position.x, position.y);
    if (item && item instanceof Bomb) {
      return false;
    }
    
    // Não pode plantar bomba se a posição não é válida para movimento
    if (!this.isValidPosition(position)) {
      return false;
    }
    
    // Verifica se não está em perigo imediato
    if (this.isInDanger(position)) {
      // Mas verifica se pelo menos uma direção adjacente está segura
      const directions = [
        { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 0, y: 1 }, { x: 0, y: -1 }
      ];
      
      let hasSafeAdjacent = false;
      for (const dir of directions) {
        const adjacentPos = {
          x: position.x + dir.x,
          y: position.y + dir.y
        };
        
        if (this.isValidPosition(adjacentPos) && !this.isInDanger(adjacentPos)) {
          hasSafeAdjacent = true;
          break;
        }
      }
      
      if (!hasSafeAdjacent) {
        return false;
      }
    }
    
    return true;
  }

  // Detecta inimigos próximos na mesma linha/coluna
  isEnemyNearAndFront() {
    const MAX_NEAR_DISTANCE = 3;
    const directions = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    for (const dir of directions) {
      for (let distance = 1; distance <= MAX_NEAR_DISTANCE; distance++) {
        const checkPos = {
          x: this.gridPos.x + (dir.x * distance),
          y: this.gridPos.y + (dir.y * distance)
        };
        
        const item = this.grid.getAt(checkPos.x, checkPos.y);
        if (item && (item instanceof Wall || item instanceof Bricks || item instanceof Bomb)) {
          break; // Caminho bloqueado
        } else if (item && item instanceof Bot && item !== this) {
          return true; // Encontrou inimigo
        }
      }
    }
    return false;
  }

  // Encontra inimigo próximo para atacar com alcance maior
  findNearbyEnemyToAttack() {
    const MAX_ATTACK_DISTANCE = 6;
    
    // Busca por todos os bots vivos no jogo
    for (const bot of this.game.state.states.Level.bots) {
      if (bot !== this && bot.alive) {
        const distance = Math.abs(bot.gridPos.x - this.gridPos.x) + Math.abs(bot.gridPos.y - this.gridPos.y);
        
        // Se está dentro do alcance de ataque
        if (distance <= MAX_ATTACK_DISTANCE) {
          const pathLength = this.findPathLength(bot.gridPos);
          
          // Se há caminho válido para o inimigo
          if (pathLength !== -1 && pathLength <= MAX_ATTACK_DISTANCE) {
            // Encontra posição adjacente ao inimigo para plantar bomba
            const attackPosition = this.findAttackPosition(bot.gridPos);
            if (attackPosition && this.canDropBombAt(attackPosition)) {
              return attackPosition;
            }
          }
        }
      }
    }
    return null;
  }

  // Encontra melhor posição para atacar um inimigo
  findAttackPosition(enemyPos) {
    const directions = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    for (const dir of directions) {
      const attackPos = {
        x: enemyPos.x + dir.x,
        y: enemyPos.y + dir.y
      };
      
      if (this.isValidPosition(attackPos) && !this.isInDanger(attackPos)) {
        return attackPos;
      }
    }
    return null;
  }

  // Encontra alvo para busca ativa quando não há objetivos próximos
  findSearchTarget() {
    // Busca por blocos destrutíveis em todo o mapa
    const allBricks = [];
    for (const item of this.grid.items) {
      if (item instanceof Bricks) {
        allBricks.push(item.gridPos);
      }
    }

    if (allBricks.length > 0) {
      // Encontra o bloco mais próximo
      let closestBrick = null;
      let closestDistance = Infinity;

      for (const brick of allBricks) {
        const distance = Math.abs(brick.x - this.gridPos.x) + Math.abs(brick.y - this.gridPos.y);
        if (distance < closestDistance) {
          const pathLength = this.findPathLength(brick);
          if (pathLength !== -1) {
            closestDistance = distance;
            closestBrick = brick;
          }
        }
      }

      if (closestBrick) {
        // Retorna posição adjacente ao bloco para plantar bomba
        return this.findAttackPosition(closestBrick) || closestBrick;
      }
    }

    // Se não há blocos, busca por inimigos em todo o mapa
    for (const bot of this.game.state.states.Level.bots) {
      if (bot !== this && bot.alive) {
        const pathLength = this.findPathLength(bot.gridPos);
        if (pathLength !== -1) {
          return this.findAttackPosition(bot.gridPos) || bot.gridPos;
        }
      }
    }

    // Se não há nada, move para centro do mapa
    const centerX = Math.floor(this.grid.width / 2);
    const centerY = Math.floor(this.grid.height / 2);
    return { x: centerX, y: centerY };
  }

  // Inicialização do bot com estado inicial
  initializeBot() {
    // Inicia no modo Think como o bomberman verde original
    this.setBotMode(this.AI_STATES.THINK);
    
    // Inicializa posição no grid se não existir
    if (!this.itemGoal) {
      this.itemGoal = { x: this.gridPos.x, y: this.gridPos.y };
    }
    
    // Alinha perfeitamente ao grid na inicialização
    const gridScreenPos = this.grid.gridToScreen(this.gridPos.x, this.gridPos.y);
    this.x = gridScreenPos.x;
    this.y = gridScreenPos.y;
    this.targetPosition = { x: this.gridPos.x, y: this.gridPos.y };
  }

}

class Pickup extends Entity {
  constructor(game, x, y, grid, index) {
    if (new.target === Pickup) {
      throw new TypeError("Cannot construct Abstract instances directly");
    }
    super(game, x, y, grid, index);
    this.body.enable = false;
    this.body.moves = false;
  }
  
  collect(player) {
    this.destroy();
  }
}

class PickupBomb extends Pickup {
  constructor(game, x, y, grid) {
    super(game, x, y, grid, 8);
    this.tint = 0x00FFFF; // Ciano para pickup de bomba
  }
  
  collect(player) {
    super.collect(player);
    player.totalBombs += 1;
  }
}

class PickupFire extends Pickup {
  constructor(game, x, y, grid) {
    super(game, x, y, grid, 9);
    this.tint = 0xFF69B4; // Rosa para pickup de fogo
  }
  
  collect(player) {
    super.collect(player);
    player.bombSize += 1;
  }
}

class PickupSpeed extends Pickup {
  constructor(game, x, y, grid) {
    // Initialize with a dummy index, will change texture immediately
    super(game, x, y, grid, 3);
    
    // Change to use the speed pickup texture
    this.loadTexture('speed_pickup');
    
    // Scale to 32x32 if needed
    this.scale.setTo(32/this.width, 32/this.height);
  }
  
  collect(player) {
    super.collect(player);
    if (player.speed < player.maxSpeed) {
      player.speed = Math.min(player.speed + 50, player.maxSpeed);
    }
  }
}

class Bomb extends Entity {
  constructor(game, x, y, grid, owner) {
    super(game, x, y, grid, 2);
    this.tint = 0x333333; // Cinza escuro para bomba

    this.owner = owner;

    this.body.immovable = true;
    this.body.moves = false;

    if (this.owner) {
      this.owner.currentBombs += 1;
    }
    
    this.size = this.owner.bombSize || 3;

    this.duration = Phaser.Timer.SECOND * 3;
    this.explodeTimer = this.game.time.events.add(this.duration, this.explode, this);

    const tween1 = this.game.add.tween(this.scale).to({x: 1.1, y: 0.9}, this.duration / 9, Phaser.Easing.Circular.InOut, true, 0, -1);
    tween1.yoyo(true, 0);
    const tween2 = this.game.add.tween(this.anchor).to({y: 0.45}, this.duration / 9, Phaser.Easing.Circular.InOut, true, 0, -1);
    tween2.yoyo(true, 0);
  }

  explode() {
    // Toca som de explosão
    gameSound.playExplosion();
    
    this.game.time.events.remove(this.explodeTimer);
    if (this.owner) {
      this.owner.currentBombs -= 1;
    }
    this.grid.remove(this);

    const explosion = new Explosion(this.game, this.x, this.y, this.grid, this.owner, this.size, this.parent);

    this.destroy();
  }

  kill() {
    this.explode();
  }
}

class Explosion extends Entity {
  constructor(game, x, y, grid, owner, size = 3, parent = null) {
    super(game, x, y, grid, 5);
    this.tint = 0xFF4500; // Laranja/vermelho para explosão
    this.size = size;
    this.owner = owner;
    this.body.immovable = true;
    this.body.moves = false;
    

    this.duration = Phaser.Timer.SECOND * .5;
    this.decayTimer = this.game.time.events.add(this.duration, this.destroy, this);

    parent.add(this);

    this.locs = this.getExplosionLocations();
    this.doExplosion();
  }

  doExplosion() {
    this.blast = [];

    // Urgh. Improve plz.
    for (let i = 0; i < this.locs.left.length; i++) {
      const blastPos = this.grid.gridToScreen(this.locs.left[i].x, this.locs.left[i].y);
      const blast = new Blast(this.game, blastPos.x, blastPos.y, this.grid, this.owner);
      blast.angle = -90;
      if (i === this.size - 2) {
        blast.frame = 3;
      }
      this.blast.push(blast);
      this.parent.add(blast);
    }

    for (let i = 0; i < this.locs.right.length; i++) {
      const blastPos = this.grid.gridToScreen(this.locs.right[i].x, this.locs.right[i].y);
      const blast = new Blast(this.game, blastPos.x, blastPos.y, this.grid, this.owner);
      blast.angle = 90;
      if (i === this.size - 2) {
        blast.frame = 3;
      }
      this.blast.push(blast);
      this.parent.add(blast);
    }

    for (let i = 0; i < this.locs.up.length; i++) {
      const blastPos = this.grid.gridToScreen(this.locs.up[i].x, this.locs.up[i].y);
      const blast = new Blast(this.game, blastPos.x, blastPos.y, this.grid, this.owner);
      blast.angle = 0;
      if (i === this.size - 2) {
        blast.frame = 3;
      }
      this.blast.push(blast);
      this.parent.add(blast);
    }

    for (let i = 0; i < this.locs.down.length; i++) {
      const blastPos = this.grid.gridToScreen(this.locs.down[i].x, this.locs.down[i].y);
      const blast = new Blast(this.game, blastPos.x, blastPos.y, this.grid, this.owner);
      blast.angle = 180;
      if (i === this.size - 2) {
        blast.frame = 3;
      }
      this.blast.push(blast);
      this.parent.add(blast);
    }
  }

  getExplosionLocations() {
    const x = this.gridPos.x;
    const y = this.gridPos.y;
    const points = {
      left: [],
      right: [],
      up: [],
      down: []
    };
    const obstructed = {
      left: false,
      right: false,
      up: false,
      down: false
    }

    // Jesus, these explosion routines... gotta fix these :(
    for (let w = 1; w < this.size; w++) {
      let entity;
      if (!obstructed.right) {
        entity = this.grid.getAt(x + w, y);
        if (!entity || entity.blastThrough) {
          points.right.push(new Phaser.Point(x + w, y));
        }
        else {
          obstructed.right = true;
          if (entity && entity instanceof Entity) {
            entity.kill();
          }
        }
      }

      if (!obstructed.left) {
        entity = this.grid.getAt(x - w, y);
        if (!entity || entity.blastThrough) {
          points.left.push(new Phaser.Point(x - w, y));
        }
        else {
          obstructed.left = true;
          if (entity && entity instanceof Entity) {
            entity.kill();
          }
        }
      }

      if (!obstructed.down) {
        entity = this.grid.getAt(x, y + w);
        if (!entity || entity.blastThrough) {
          points.down.push(new Phaser.Point(x, y + w));
        }
        else {
          obstructed.down = true;
          if (entity && entity instanceof Entity) {
            entity.kill();
          }
        }
      }

      if (!obstructed.up) {
        entity = this.grid.getAt(x, y - w);
        if (!entity || entity.blastThrough) {
          points.up.push(new Phaser.Point(x, y - w));
        }
        else {
          obstructed.up = true;
          if (entity && entity instanceof Entity) {
            entity.kill();
          }
        }
      }
    }
    return points;
  }

  destroy() {
    this.game.time.events.remove(this.decayTimer);
    for (let i = 0; i < this.blast.length; i++) {
      this.blast[i].destroy();
    }
    const tween = this.game.add.tween(this).to({alpha: 0}, 300, Phaser.Easing.Linear.None, true);
    tween.onComplete.add(() => {
      super.destroy();
    }, this);
  }
  
  kill() {
    // cannot be killed
  }
}

class Blast extends Entity {
  constructor(game, x, y, grid, owner) {
    super(game, x, y, grid, 4);
    this.tint = 0xFFFF00; // Amarelo para blast
    this.body.moves = false;
    this.body.immovable = true;
    this.slack = 18;
    this.body.setSize(32 - this.slack, 32 - this.slack, this.slack * 0.5, this.slack * 0.5)
    
    this.blastThrough = true;
  }
  
  kill() {
    // cannot be killed
  }
  
  destroy() {
    this.body.enable = false;
    const tween = this.game.add.tween(this).to({alpha: 0}, 300, Phaser.Easing.Linear.None, true);
    tween.onComplete.add(() => {
      super.destroy();
    }, this);
  }
}

class Grid {
  constructor(width, height, size = 32) {
    this.width = width;
    this.height = height;
    this.size = size;
    this.items = [];
  }

  add(item) {
    this.items.push(item);
    item.gridPos = this.screenToGrid(item.x, item.y);
  }

  remove(item) {
    if (this.items.indexOf(item) !== -1) {
      this.items.splice(this.items.indexOf(item), 1);
    }
  }

  getAt(x, y, ignore) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      for (let i = 0; i < this.items.length; i++) {
        let item = this.items[i];
        if (item !== ignore && item.gridPos.x === x && item.gridPos.y === y) {
          return item;
        }
      }
      return null;
    }
    return -1;
  }

  screenToGrid(x, y, point) {
    if (point) {
      point.x = Math.round(x / this.size);
      point.y = Math.round(y / this.size);
      return point;
    }
    return new Phaser.Point(Math.round(x / this.size), Math.round(y / this.size));
  }

  gridToScreen(x, y, point) {
    if (point) {
      point.x = x * this.size;
      point.y = y * this.size;
      return point;
    }
    return new Phaser.Point(x * this.size, y * this.size);
  }
}

class Level extends Phaser.State {
  preload() {
    this.stage.disableVisibilityChange = true;
    this.game.load.spritesheet('sprites', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACABAMAAAAxEHz4AAAAElBMVEUAAAD///+2trZLS0va2toAAAAGLkTLAAAAAXRSTlMAQObYZgAABB5JREFUaN6Ml2GO3CAMhRE5QZIewDy2/5Nwgq72BJV6/6vU2J4ExmzL+5HB0vD02TF4Jnytnb4iOlH4n371Bj+gylBdYajGen3Tm0EOoqWUgz9i1FAwXwYbmt3pHBIUUQNAQKSXwfYYpDQkKKawGgFE0wRLMZ0GEKnWgGi2BqUgmwFpBURjgzOXTlcFuNZNgv1QAlKLMUGLrwSlpJdBeTIAxTHBm8ElAGqQsr5LqGiSYGGANddsEsQAqAQbP6cILAMzKNUg8naG2jBFIAZZDKAGvD+l+s049xZkowhZCRDXqg1TfcAl2Bq/gwkYQb5JNDBwndgblGpASEoQ5wiu3BMEmAGBpghYPQFgNQBNEbA6AkgKWoSpt9Aq22u0FDDRB94g3EUETXViq10PoxnQ3FnoS/AUMSHOEHQG6dBOvFOYIQgNwB6aIiYEmruReoAAMwATuEt1eCu3AHqcN0vBX+vjW7kB0LMEM8AUgSFcqQTV3Ylx0EjfTKbrunJ55uJmNZDhunf6kXu1s1EV71aWPvDj/ep0BCewgxFEtUS0nOBir683yYb2cPh4bPDRGMQ7JwQXi4roGBG43o59LFpW0T4i6E8XR0RtrA7nqjrGBOGFTNUAhKcG7GUAhjAmIDtdmgKAO2Y3AzCEf74FENASyEoNiuhUA08QsD1FA+uOtdfOHT9/4w/yNwT96YLIYtY3Bp+NAQmyMgemSUga82Jk0Ks/XUQhJawqXUwQoBuW65smCKjJ2RnMEER2uFMYGqwFrHx+T2Ap0IBAO1HaQDrxk1UJPlhm0M97b+BbuZrU3dWkpvA0ztignLYu4xT6ee8Nyl4MoOyHa2U3753Bwhurg3zsjsDN+5RW2KiRRWB+ZqjaeXm8E7h5j9rJllLitRicoqIGvdy8R5XFVUog8gT+TjQDjdVgOfcXQVmLq4Gb90TNjcQBt8GxlMpQSii+ld28fwief1aL/OVBHl3rbt5HBnpivdjl5zY/juAJ3LyniCaOCgBkeQwI3Lx3cWfgCfy87+MJgn7eu3iCoJv3LrbZeshjXIPu6LzHE1pLo5Xjv+3VwW3DMAyFYWQDPxodgOQE5hulyP6rtFVkR1YPFhPkpv8sfCZsg7o3DQg3Wttyu7NtuQaiA75ZilFgtVP6xb/cK7GNAmQLhIQ5E0A5bKZyTEBIYgJnKaROEAwqbBxgPA4/34G6Qn0c2FCWpj0nUECGJ2AA5amsgLoAEB8GFHICgorfRgGnwk+ACXJA/Yw7EKEFkFEghLV4AHwXMOQAsgMEojDAXwdcZNM8EPt/gBXYkAe2AyiNAnYA3gFMArG+CNgxwBmQJBCyA5EFvAAaHbBmVloEm52oBfA3lirQLZTsWjdAOAbcrLtYeGr5JFCDNeHfZXvV1fU+m81ms9lslu4HtQ9fHtWYNW8AAAAASUVORK5CYII=', 32, 32);
    // Load speed pickup sprite separately
    this.game.load.image('speed_pickup', '../sprites/patins_powerup.png');
  }

  create() {
    this.game.renderer.renderSession.roundPixels = true;
    this.game.physics.startSystem(Phaser.Physics.ARCADE);

    this.game.input.keyboard.addKeyCapture([ Phaser.Keyboard.UP, Phaser.Keyboard.DOWN, Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.SPACEBAR ]);

    // Flag para controlar fim do jogo
    this.gameEnded = false;
    
    this.grid = new Grid(18, 14);

    this.background = this.game.add.group();
    this.items = this.game.add.physicsGroup();
    this.items.x = this.background.x = 16;
    this.items.y = this.background.y = 16;

    // Generate bot positions before map generation
    const botGridPositions = this.generateDistributedSpawnPositions(12);

    for (let x = 0; x <= this.grid.width; x++) {
      for (let y = 0; y <= this.grid.height; y ++) {
        if (x === 0 || y === 0 || x === this.grid.width || y === this.grid.height) {
          const wall = new Wall(this.game, x * this.grid.size, y * this.grid.size, this.grid);
          this.items.add(wall);
        }
        else if ((x > 0 && x < this.grid.width && !(x%2)) && (y > 0 && y < this.grid.height && !(y%2))) {
          const wall = new Wall(this.game, x * this.grid.size, y * this.grid.size, this.grid);
          this.items.add(wall);
        }
        else {
          const grassTile = this.background.create((x * this.grid.size), (y * this.grid.size), 'sprites', 7);
          grassTile.anchor.set(.5);
          grassTile.tint = 0x228B22; // Verde
          
          // Usa as posições dos bots dinamicamente geradas
          const playerPositions = botGridPositions;
          
          let shouldPlaceBrick = true;
          
          for (let pos of playerPositions) {
            const distanceFromPlayer = Math.abs(x - pos.x) + Math.abs(y - pos.y);
            if (distanceFromPlayer <= 2) {
              shouldPlaceBrick = false;
              break;
            }
          }
          
          // Geração aleatória de blocos destrutíveis (60% de chance)
          if (shouldPlaceBrick && x > 0 && x < this.grid.width && y > 0 && y < this.grid.height && Math.random() < 0.6) {
            const bricks = new Bricks(this.game, x * this.grid.size, y * this.grid.size, this.grid);
            this.items.add(bricks);
          }
        }
      }
    }

    this.bots = [];

    // Converte posições de grid para posições de tela
    const botPositions = botGridPositions.map(gridPos => ({
      x: gridPos.x * this.grid.size,
      y: gridPos.y * this.grid.size
    }));

    for (let i = 0; i < botPositions.length; i++) {
      const pos = botPositions[i];
      const gridPos = botGridPositions[i];
      
      // Verifica se a posição está livre antes de criar o bot
      const existingItem = this.grid.getAt(gridPos.x, gridPos.y);
      if (existingItem && (existingItem instanceof Wall || existingItem instanceof Bricks)) {
        console.warn(`Bot ${i} tentando spawnar em posição ocupada (${gridPos.x}, ${gridPos.y})`);
        // Remove o obstáculo se necessário
        existingItem.destroy();
      }
      
      const bot = new Bot(this.game, pos.x, pos.y, this.grid, i);
      // Inicializa bot com nova IA do bomberman verde
      bot.initializeBot();
      this.bots.push(bot);
      this.items.add(bot);
      
      console.log(`Bot ${i} criado na posição grid (${gridPos.x}, ${gridPos.y}) tela (${pos.x}, ${pos.y})`);
    }

  };

  // Gera posições de spawn distribuídas inteligentemente pelo mapa
  isFixedWall(x, y) {
    const gridWidth = this.grid.width;
    const gridHeight = this.grid.height;
    
    // Check border walls
    if (x === 0 || y === 0 || x === gridWidth || y === gridHeight) {
      return true;
    }
    
    // Check fixed interior walls (even positions both in x and y)
    if ((x > 0 && x < gridWidth && !(x % 2)) && (y > 0 && y < gridHeight && !(y % 2))) {
      return true;
    }
    
    return false;
  }

  generateDistributedSpawnPositions(numBots) {
    const positions = [];
    const gridWidth = this.grid.width;
    const gridHeight = this.grid.height;
    
    // Define setores do mapa para distribuição equilibrada
    const sectors = [
      // Cantos
      { x: 1, y: 1, priority: 1 },         // Superior esquerdo
      { x: gridWidth - 2, y: 1, priority: 1 },           // Superior direito  
      { x: 1, y: gridHeight - 2, priority: 1 },          // Inferior esquerdo
      { x: gridWidth - 2, y: gridHeight - 2, priority: 1 }, // Inferior direito
      
      // Bordas médias
      { x: Math.floor(gridWidth/2), y: 1, priority: 2 },         // Meio superior
      { x: Math.floor(gridWidth/2), y: gridHeight - 2, priority: 2 }, // Meio inferior
      { x: 1, y: Math.floor(gridHeight/2), priority: 2 },        // Meio esquerda
      { x: gridWidth - 2, y: Math.floor(gridHeight/2), priority: 2 }, // Meio direita
      
      // Área central externa
      { x: 3, y: 3, priority: 3 },
      { x: gridWidth - 4, y: 3, priority: 3 },
      { x: 3, y: gridHeight - 4, priority: 3 },
      { x: gridWidth - 4, y: gridHeight - 4, priority: 3 },
      
      // Área central média
      { x: 5, y: 5, priority: 4 },
      { x: gridWidth - 6, y: 5, priority: 4 },
      { x: 5, y: gridHeight - 6, priority: 4 },
      { x: gridWidth - 6, y: gridHeight - 6, priority: 4 },
      
      // Posições intermediárias horizontais
      { x: 7, y: 1, priority: 5 },
      { x: 9, y: 1, priority: 5 },
      { x: 11, y: 1, priority: 5 },
      { x: 7, y: gridHeight - 2, priority: 5 },
      { x: 9, y: gridHeight - 2, priority: 5 },
      { x: 11, y: gridHeight - 2, priority: 5 },
      
      // Posições intermediárias verticais
      { x: 1, y: 5, priority: 5 },
      { x: 1, y: 7, priority: 5 },
      { x: 1, y: 9, priority: 5 },
      { x: gridWidth - 2, y: 5, priority: 5 },
      { x: gridWidth - 2, y: 7, priority: 5 },
      { x: gridWidth - 2, y: 9, priority: 5 }
    ];
    
    // Filtra apenas posições válidas (não são paredes fixas e dentro dos limites)
    const validSectors = sectors.filter(pos => 
      !this.isFixedWall(pos.x, pos.y) && 
      pos.x > 0 && pos.x < gridWidth && 
      pos.y > 0 && pos.y < gridHeight
    );
    
    // Ordena por prioridade (cantos primeiro, depois bordas, etc.)
    validSectors.sort((a, b) => a.priority - b.priority);
    
    // Seleciona posições com distribuição inteligente
    const minDistance = 3; // Distância mínima entre bots
    
    for (let sector of validSectors) {
      if (positions.length >= numBots) break;
      
      // Verifica se esta posição está suficientemente longe das outras
      let tooClose = false;
      for (let existingPos of positions) {
        const distance = Math.abs(sector.x - existingPos.x) + Math.abs(sector.y - existingPos.y);
        if (distance < minDistance) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        positions.push({ x: sector.x, y: sector.y });
      }
    }
    
    // Se não temos bots suficientes, adiciona posições aleatórias válidas
    while (positions.length < numBots) {
      const maxAttempts = 50;
      let attempts = 0;
      let found = false;
      
      while (!found && attempts < maxAttempts) {
        const x = 1 + Math.floor(Math.random() * (gridWidth - 2));
        const y = 1 + Math.floor(Math.random() * (gridHeight - 2));
        
        // Skip if it's a fixed wall position
        if (this.isFixedWall(x, y)) {
          attempts++;
          continue;
        }
        
        // Verifica distância das posições existentes
        let validPosition = true;
        for (let existingPos of positions) {
          const distance = Math.abs(x - existingPos.x) + Math.abs(y - existingPos.y);
          if (distance < minDistance - 1) { // Reduz um pouco a exigência
            validPosition = false;
            break;
          }
        }
        
        if (validPosition) {
          positions.push({ x, y });
          found = true;
        }
        attempts++;
      }
      
      // Se ainda não conseguiu, adiciona qualquer posição válida
      if (!found) {
        for (let x = 1; x < gridWidth - 1; x++) {
          for (let y = 1; y < gridHeight - 1; y++) {
            if (!this.isFixedWall(x, y)) {
              let exists = positions.some(pos => pos.x === x && pos.y === y);
              if (!exists) {
                positions.push({ x, y });
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
      }
    }
    
    console.log('Posições de spawn geradas:', positions);
    return positions.slice(0, numBots);
  }

  showVictory(winner) {
    // Para o jogo para evitar que os bots continuem atualizando
    this.gameEnded = true;
    
    // Cria overlay de vitória
    const overlay = this.game.add.graphics(0, 0);
    overlay.beginFill(0x000000, 0.7);
    overlay.drawRect(0, 0, this.game.width, this.game.height);
    overlay.endFill();
    overlay.fixedToCamera = true;
    
    // Texto de vitória
    const victoryText = this.game.add.text(this.game.width / 2, this.game.height / 2 - 50, 
      `Bot ${winner.botId + 1} Venceu!`, {
      font: '32px Arial',
      fill: '#ffffff',
      align: 'center'
    });
    victoryText.anchor.setTo(0.5);
    victoryText.fixedToCamera = true;
    
    // Aplicar cor do bot vencedor no texto
    victoryText.tint = winner.tint;
    
    // Botão de reiniciar usando Sprite ao invés de Text para melhor compatibilidade
    const buttonBg = this.game.add.graphics(this.game.width / 2 - 100, this.game.height / 2 + 10);
    buttonBg.beginFill(0x006600);
    buttonBg.drawRoundedRect(0, 0, 200, 40, 5);
    buttonBg.endFill();
    buttonBg.fixedToCamera = true;
    
    const restartButton = this.game.add.text(this.game.width / 2, this.game.height / 2 + 30, 
      'Jogar Novamente', {
      font: '20px Arial',
      fill: '#ffffff',
      align: 'center'
    });
    restartButton.anchor.setTo(0.5);
    restartButton.fixedToCamera = true;
    
    // Área clicável invisível sobre o botão
    const clickArea = this.game.add.graphics(this.game.width / 2 - 100, this.game.height / 2 + 10);
    clickArea.beginFill(0x000000, 0); // Transparente
    clickArea.drawRect(0, 0, 200, 40);
    clickArea.endFill();
    clickArea.fixedToCamera = true;
    
    // Habilita input na área clicável
    clickArea.inputEnabled = true;
    clickArea.input.useHandCursor = true;
    
    // Função de restart
    const restartGame = () => {
      console.log('Reiniciando jogo...');
      
      // Remove elementos
      if (overlay) overlay.destroy();
      if (victoryText) victoryText.destroy();
      if (restartButton) restartButton.destroy();
      if (buttonBg) buttonBg.destroy();
      if (clickArea) clickArea.destroy();
      
      // Limpa todos os timers e eventos
      this.game.time.events.removeAll();
      
      // Reinicia o estado
      this.game.state.restart();
    };
    
    // Evento de clique na área
    clickArea.events.onInputDown.add(restartGame, this);
    
    // Efeito hover
    clickArea.events.onInputOver.add(() => {
      buttonBg.clear();
      buttonBg.beginFill(0x00aa00);
      buttonBg.drawRoundedRect(0, 0, 200, 40, 5);
      buttonBg.endFill();
      restartButton.scale.setTo(1.05);
    }, this);
    
    clickArea.events.onInputOut.add(() => {
      buttonBg.clear();
      buttonBg.beginFill(0x006600);
      buttonBg.drawRoundedRect(0, 0, 200, 40, 5);
      buttonBg.endFill();
      restartButton.scale.setTo(1.0);
    }, this);
    
    // Alternativa: reinício com tecla ENTER ou SPACE
    const restartHandler = () => {
      restartGame();
    };
    
    const enterKey = this.game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    const spaceKey = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    
    enterKey.onDown.addOnce(restartHandler, this);
    spaceKey.onDown.addOnce(restartHandler, this);
    
    // Mensagem de instrução adicional
    const instructionText = this.game.add.text(this.game.width / 2, this.game.height / 2 + 80, 
      'ou pressione ENTER/SPACE', {
      font: '14px Arial',
      fill: '#cccccc',
      align: 'center'
    });
    instructionText.anchor.setTo(0.5);
    instructionText.fixedToCamera = true;
  }

  update() {
    // Para de atualizar se o jogo terminou
    if (this.gameEnded) {
      return;
    }
    
    // Check if bots array is initialized
    if (!this.bots || !Array.isArray(this.bots)) {
      return;
    }
    
    for (let bot of this.bots) {
      if (bot.alive) {
        this.game.physics.arcade.overlap(bot, this.items, (a, b) => {
          // Só mata se for fogo/explosão, ignora outros bots
          if (a instanceof Bot && (b instanceof Blast || b instanceof Explosion)) {
            a.kill();
          }
        });
      }
    }
  };

  render() {
    /*
    this.game.debug.start();
    this.items.forEach((i) => {
      if (i.alive) {
        this.game.debug.context.fillStyle = 'rgba(255, 0, 0, 0.4)';
        const gridPos = this.grid.gridToScreen(i.gridPos.x, i.gridPos.y);
        this.game.debug.context.fillRect(gridPos.x, gridPos.y, this.grid.size, this.grid.size);
      }
    });
    this.game.debug.stop();

    this.items.forEach((i) => {
      if (i.alive) {
        this.game.debug.body(i);
      }
    })
    */
  };
};

class Game extends Phaser.Game {
  constructor() {
    super(608, 480, Phaser.AUTO, 'screen', null);
    this.state.add('Level', Level, false);
    this.state.start('Level');
  };
};

new Game();