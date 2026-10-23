# 烬途

二维像素横版动作肉鸽。一间一间的房间拼成一张真正的平面地图：走路、跳跃、下落穿过左右和上下的门。战斗按帧计算，有出招、有效、后摇、取消、弹反和霸体。三层生态，每层一个多阶段首领。

在线地址：<https://enma-aix.github.io/pixel-rogue-fighter/>

## 怎么玩

桌面优先，手机请横过来。

| 动作 | 默认按键 | 手柄 |
| --- | --- | --- |
| 移动 | A D 或方向键 | 左摇杆 / 十字键 |
| 跳跃 | 空格 | A |
| 下跳平台 | S + 空格 | 下 + A |
| 普攻连段 | J | X |
| 重击（按住蓄力） | K | Y |
| 冲刺 | L 或 Shift | B |
| 弹反 | I | LB |
| 技能 | U | RB |
| 服药 | Q | LT |
| 互动 | F | RT |
| 地图 | M 或 Tab | Back |
| 暂停 | Esc | Start |
| 空中下劈 | S + J | 下 + X |

战斗房和精英房、首领房会锁门，清空后才打开。隐藏墙可以用武器打碎。本局的余烬在倒下或通关时化为烬核，回到标题的祭坛里解锁武器、角色和永久强化。存档在本地浏览器里。

## 本地运行

需要 Node.js 22。

```bash
npm ci
npm run dev
```

打开 <http://localhost:5173/pixel-rogue-fighter/>。

```bash
npm test
npm run build
npm run preview
```

构建时的资源前缀默认是 `/pixel-rogue-fighter/`。本地如果想用根路径预览，可以 `VITE_BASE=/ npm run build`。

## 开启 GitHub Pages

仓库已经带了 `.github/workflows/pages.yml`。把它推到 `main` 之后：

1. 打开仓库的 Settings → Pages。
2. Build and deployment 选 GitHub Actions。
3. 等 Actions 里的 `pages` 工作流变绿。

工作流会执行测试，再用 `VITE_BASE=/pixel-rogue-fighter/` 构建，把 `dist` 发布到 Pages。
