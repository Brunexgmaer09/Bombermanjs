# 🎮 Bomberman Phaser - Enhanced Edition

Uma versão aprimorada do clássico Bomberman criada com Phaser.js, com melhorias significativas de gameplay, IA avançada e novos power-ups.

## 🌟 Características Principais

### ✨ Melhorias Implementadas
- **IA Avançada dos Bots**: Sistema de IA inteligente baseado no Bomberman clássico com múltiplos estados (THINK, ITEM, DEFEND)
- **Novo Power-Up de Velocidade**: Patins que aumentam significativamente a velocidade de movimento
- **Sistema de Colisão Aprimorado**: Lógica refinada para movimentação e colisão com bombas
- **Spawn Inteligente**: Distribuição equilibrada de bots pelo mapa evitando paredes fixas
- **Balanceamento Melhorado**: Chances aumentadas de power-ups e velocidades mais dinâmicas

### 🎯 Funcionalidades do Jogo
- **Multiplayer Local**: Jogador vs 12 bots inteligentes
- **Sistema de Power-ups**:
  - 💣 **Bomb Power-up** (Ciano): Aumenta o número de bombas
  - 🔥 **Fire Power-up** (Rosa): Aumenta o alcance da explosão
  - 👟 **Speed Power-up** (Verde): Aumenta a velocidade de movimento
- **Sistema de Som**: Efeitos sonoros para explosões e ações
- **Física Realista**: Movimento fluido e detecção de colisão precisa

## 🚀 Como Jogar

### Controles
- **Setas**: Movimento do jogador
- **Espaço**: Plantar bomba

### Objetivo
Elimine todos os bots usando bombas estrategicamente posicionadas. Colete power-ups para melhorar suas habilidades!

### Estratégias
1. **Colete Power-ups**: Quebre blocos destrutíveis para revelar power-ups
2. **Use o Terreno**: Aproveite paredes e obstáculos para se proteger
3. **Velocidade é Chave**: Patins te dão vantagem significativa na mobilidade
4. **Timing das Bombas**: Bombas explodem em 3 segundos - planeje sua fuga!

## 🛠️ Tecnologias Utilizadas

- **Phaser.js**: Framework de jogos 2D em JavaScript
- **HTML5 Canvas**: Renderização de gráficos
- **Web Audio API**: Sistema de som personalizado
- **ES6+ JavaScript**: Código moderno e orientado a objetos

## 📊 Especificações Técnicas

### Sistema de IA
- **Estados da IA**: THINK (exploração), ITEM (coleta), DEFEND (fuga)
- **Sistema BURN_MARK**: Avaliação inteligente de posições para bombas
- **Pathfinding**: Navegação inteligente evitando perigos
- **Campo de Visão**: IA com alcance de 12 tiles

### Balanceamento do Jogo
- **Velocidade Base**: 120 pixels/segundo
- **Boost de Velocidade**: +50 por pickup de patins
- **Velocidade Máxima**: 320 pixels/segundo
- **Chance de Power-up**: 50% por bloco destruído
- **Tempo de Explosão**: 3 segundos

## 🎨 Assets e Sprites

- **Spritesheet Principal**: 32x32 pixels por sprite
- **Sprite Personalizada**: Power-up de patins (patins_powerup.png)
- **Cores dos Power-ups**:
  - Bomba: Ciano (#00FFFF)
  - Fogo: Rosa (#FF69B4)
  - Velocidade: Verde (#00FF00)

## 📁 Estrutura do Projeto

```
bomberman-phaser/
├── dist/
│   ├── index.html          # Página principal
│   ├── script.js           # Código do jogo
│   └── style.css           # Estilos
├── sprites/
│   └── patins_powerup.png  # Sprite do power-up de velocidade
├── LICENSE.txt             # Licença
└── README.md              # Este arquivo
```

## 🚀 Como Executar

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/Bruno/Bombermanjs.git
   cd Bombermanjs/bomberman-phaser
   ```

2. **Abra o jogo**:
   - Abra `dist/index.html` em um navegador web moderno
   - Ou use um servidor local para melhor performance

3. **Comece a Jogar**:
   - Use as setas para mover
   - Pressione espaço para plantar bombas
   - Colete power-ups e elimine todos os bots!

## 🏆 Características Avançadas

### Sistema de Escape de Bombas
- Jogadores podem passar através de sua própria bomba inicialmente
- Uma vez que saem da bomba, não podem mais atravessá-la
- Impossível atravessar bombas de outros jogadores

### IA Comportamental
- **Modo Agressivo**: Busca ativamente por inimigos
- **Modo Defensivo**: Foge de situações perigosas
- **Coleta Inteligente**: Prioriza power-ups estrategicamente

### Sistema de Spawn Distribuído
- Bots nascem em posições estratégicas pelo mapa
- Algoritmo evita paredes fixas e sobreposições
- Distância mínima entre spawns para gameplay justo

## 🐛 Correções Implementadas

- ✅ Corrigido erro de inicialização `botGridPositions`
- ✅ Corrigido erro de iteração `this.bots is not iterable`
- ✅ Implementado sistema de colisão adequado para power-ups
- ✅ Corrigido sistema de destruição por explosões
- ✅ Melhorado spawn distribution evitando paredes fixas

## 📝 Créditos

- **Versão Original**: [CodePen - lewster32](https://codepen.io/lewster32/pen/KvzVVd)
- **Melhorias e Aprimoramentos**: Bruno (brunooliveiirah@gmail.com)
- **Framework**: Phaser.js Community

## 📄 Licença

Este projeto mantém a licença original. Veja `LICENSE.txt` para mais detalhes.

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se livre para:
- Reportar bugs
- Sugerir novas funcionalidades
- Melhorar a documentação
- Otimizar o código

---

**Divirta-se jogando! 💣🎮**