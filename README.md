# RockRat  岩鼠：舒舒服服做科研   <img src="https://github.com/deng113jie/rockrat/blob/master/icon/rockrat.png" width="100" height="100">

A web-based IDE for orchestrating AI-driven research pipelines using Claude Code agents.

![RockRat Main UI](https://github.com/deng113jie/rockrat/blob/master/front_ui.png)


## Getting Started

### 1. Install Node.js

Download and install Node.js (v18 or later) from [nodejs.org](https://nodejs.org).

Verify the installation using bash or cmd (Windows: 开始，搜索/输入 cmd ， 点击“命令提示符”):

```bash
node -v
npm -v
```


### 2. Install Claude Code

Windows下需要提前安装git https://git-scm.com/install/windows
```bash
npm install -g @anthropic-ai/claude-code
```

关闭cmd，再重新打开，输入
```bash
claude
```
测试是否安装成功。成功后直接关闭cmd窗口即可。

### 3. Install dependencies

如果是cmd界面，需要先cd到项目目录。例如：cd C:\Users\abc\Document\code\research-agent-ui

然后输入：

```bash
npm install
```

安装相关依赖包This installs Express, Multer, and the Claude Agent SDK.

### 3. Set your Anthropic API key

The agent feature requires an Anthropic API key. 

在.env文件中包含了一个测试API，但请求数有限制。

因此测试时这步可以略过。如需长期使用，请自行购买claude token api，或联系我（wx:wayfull001）


```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

### 4. Start the server

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Always use `http://localhost:3000` — opening `index.html` directly in the browser (e.g. via a file:// URL or an IDE preview server) will break the paper list and agent features, which require the Express backend.

## Features

- **知识库 (Knowledge Base)** — reads PDF files from the local `./papers` directory; supports upload via drag-and-drop or file picker. 
- **开始调研 (Start Research)** — select papers and click this button to run a Claude Code agent that analyses the selected files and streams results back live. Output study.md
- **Pipeline** — visual node graph for orchestrating multi-stage research workflows (literature review → experiments → paper writing → review)
- **生成创新点** Use idea skill to generate idea.md, which contains few ideas based on related work surveyed.
- **研究方案** plan.md contains the full research plan, once you adopt 采纳 one of the innovative idea
- **开始进行编程** The agent shall read the plan.md and start implementation, put results into results.md and generate figures for writting paper
- **撰写论文** generate latex file into the latex folder with one .tex file per section, and paper.tex as the main file
- **Review** — approval ledger and reviewer notes in review.md

## 视频教程

安装教程 请点击 -> [![安装教程](https://i2.hdslb.com/bfs/archive/4cb5123a4867a671d490cc142867367d5b53fc03.jpg)](https://www.bilibili.com/video/BV1rTomBGEx8/)

使用过程 请点击 -> [![使用过程](https://i2.hdslb.com/bfs/archive/e66a8b14f45fbc4e060da28bd4b47130e8f9047a.jpg)](https://www.bilibili.com/video/BV1tPdmBHE1y/)



## 使用时注意

- 如果需要agent自动使用IEEE Xplore，请1)安装chrome, 2) 在chrome中输入 chrome://inspect/#remote-debugging  启用远程调试， 3）打开IEEE Xplore并登录
- 有任何问题，可以联系（wx:wayfull001）

## 设计理念

[点我了解一下岩鼠的设计理念](./intro.md) 

## Contributors and Acknowledgement
- Ye Wang
- Jie Deng
- Rongxiang He
- Jifei Xu

Some of the skills are from:
- [IEEE Skills](https://github.com/cookjohn/ieee-skills)
- [DeepScientist](https://github.com/ResearAI/DeepScientist)
- [Google ScholarPeer](https://arxiv.org/pdf/2601.22638)