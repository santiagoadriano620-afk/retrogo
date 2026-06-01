# Alterar cores das notificações

## 1. Mensagens vermelhas (centro do ecrã) → verde

**Ficheiro:** `client/src/network/packet-handler.js` (linha ~687-690)

**Antes:**
```js
  // Loot and look messages are green, others are red
  let color = string.startsWith("Loot of") || string.startsWith("You see")
    ? Interface.prototype.COLORS.LIGHTGREEN
    : Interface.prototype.COLORS.RED;
```

**Depois:**
```js
  let color = Interface.prototype.COLORS.LIGHTGREEN;
```

## 2. Mensagens brancas no rodapé → branco mais sólido

**Ficheiro:** `client/modules/new/new.css` (linha 589)

**Antes:**
```css
  color: #d3d3d3;
```

**Depois:**
```css
  color: #F5F5F5;
```

---

### Notas

- `COLORS.LIGHTGREEN` = índice 30 no array `WEBCOLORS` = `#00FF00` (mesmo verde usado nas mensagens "You see" e "Loot of")
- `#F5F5F5` é branco mais sólido que `#d3d3d3`, mantendo um tom ligeiramente suave em vez de `#FFFFFF` puro
