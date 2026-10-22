# 烬途

一款浏览器里的横版像素肉鸽格斗。一局三折，沿途清掉敌群，折末三选一强化；金币会留下来，死了也能拿去做永久强化。

画面是程序绘制的像素角色，不使用外部付费素材。界面字体为 [ZCOOL KuaiLe](https://fonts.google.com/specimen/ZCOOL+KuaiLe)（SIL Open Font License，见 `src/assets/OFL-ZCOOLKuaiLe.txt`）。

## 本地运行

需要 Node.js 20 或更新版本。

```bash
npm install
npm run dev
```

浏览器打开终端里给出的本地地址。生产构建：

```bash
npm run build
npm run preview
```

`npm run build` 会先做类型检查，再把静态站点输出到 `dist/`。`vite.config.ts` 里 `base` 为 `./`，可以直接用静态服务器打开，也可以放到 GitHub Pages。

## 怎么玩

1. 在标题选「开始征途」。
2. 每一折由几段地形拼成，敌人组合会变。清光这一折的敌人，走进发光的出口。
3. 折末从三张强化里选一张。例如加伤害、吸血、缩短闪避冷却、奥义附带冲击波。
4. 第三折尽头是首领「残将 · 玄甲」。打倒即破阵；生命归零则本局结束。
5. 战斗里拿到的金币会立刻存进浏览器本地。标题里的「永久强化」可以买体质、力量、身法、奥义和财运，下次开局仍然有效。

## 操作

| 动作 | 按键 |
| --- | --- |
| 移动 | `A` / `D` 或 `←` / `→` |
| 跳跃 | `W`、空格或 `↑`。点按跳得矮，按住跳得高 |
| 轻击 | `J` |
| 重击 | `K` |
| 闪避 | `L` 或 `Shift`。闪避中有短暂无敌 |
| 奥义 | `U`。有冷却 |
| 连招 | `J` → `J` → `K` |
| 暂停 | `Esc` |
| 音效 | `M` |
| 菜单 | `↑` `↓` 选择，`Enter` 确认 |

触屏或较窄的窗口会在画面下方出现「左 右 跳 轻 重 闪 奥」。

## 部署到 GitHub Pages

仓库里有 `.github/workflows/pages.yml`。推到 `main` 后，到仓库 Settings → Pages，把 Source 设为 GitHub Actions。动作跑完后，站点地址会出现在该次运行的环境网址里。
