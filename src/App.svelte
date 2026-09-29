<script lang="ts">
  import { consoleStore as store } from './lib/console.svelte';
  import StageSVG from './lib/components/StageSVG.svelte';
  import CueList from './lib/components/CueList.svelte';
  import CueEditor from './lib/components/CueEditor.svelte';
  import Transport from './lib/components/Transport.svelte';
  import ManualPanel from './lib/components/ManualPanel.svelte';
  import PatchPanel from './lib/components/PatchPanel.svelte';
  import DmxMonitor from './lib/components/DmxMonitor.svelte';

  const examples = [
    '点 GO 执行第一个 Cue（开场暖场），观察灯 1/2/11/12 按各自升光秒数渐亮。',
    '跟随 2 秒后自动进入“主角定点”；渐变中再点 GO 会从当时亮度接续，不回旧目标。',
    '在节目单点“跳”可跳场；暂停会冻结渐变与跟随倒计时，继续只走剩余时间。',
    '手动区点 #5“接管”后拖动滑杆；释放即回到当时基础亮度。总控与黑场只改输出。',
    '在场地配接区修改灯型或灯具草稿，修正错误后点“应用配接”；运行或暂停中都不会重置 Cue、渐变和接管。',
    '切换宇宙查看四个 512 字节帧；黑场或停止时调光槽归零，常量槽仍保持配置值。',
  ];
</script>

<main>
  <h1>小剧场灯光走台控台</h1>
  <p class="sub">12 盏调光灯 · Cue 走台 · 跟随自动连场 · 手动接管 · 纯浏览器模拟（无硬件）</p>

  <div class="layout">
    <div class="col left">
      <CueList running={store.running} />
    </div>
    <div class="col center">
      <StageSVG
        outputs={store.snap.outputLevels}
        base={store.snap.baseLevels}
        takeover={store.snap.takeover}
      />
      <Transport />
      <ManualPanel />
      <DmxMonitor />
    </div>
    <div class="col right">
      <CueEditor running={store.running} />
    </div>
  </div>

  <div class="patch-wrap">
    <PatchPanel />
  </div>

  <section class="examples">
    <h2>操作示例</h2>
    <ol>
      {#each examples as text (text)}
        <li>{text}</li>
      {/each}
    </ol>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0e1016;
    color: #d7dcea;
    font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  }
  :global(button) {
    background: #1c2029;
    color: #d7dcea;
    border: 1px solid #323846;
    border-radius: 6px;
    cursor: pointer;
  }
  :global(button:disabled) { opacity: 0.4; cursor: not-allowed; }
  :global(input) {
    background: #0e1016;
    color: #e6e9f2;
    border: 1px solid #323846;
    border-radius: 5px;
    padding: 4px 6px;
    font-size: 12px;
    width: 100%;
    box-sizing: border-box;
  }
  main { max-width: 1280px; margin: 0 auto; padding: 16px 20px 40px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { margin: 0 0 14px; font-size: 12px; color: #7d8598; }
  .layout {
    display: grid;
    grid-template-columns: 280px 1fr 380px;
    gap: 14px;
    align-items: start;
  }
  .col {
    background: #14161e;
    border: 1px solid #232733;
    border-radius: 10px;
    padding: 12px;
    min-width: 0;
  }
  .col.center { display: flex; flex-direction: column; gap: 14px; }
  .col.left, .col.right { max-height: 760px; overflow: hidden; }
  .patch-wrap { margin-top: 14px; }
  .examples {
    margin-top: 18px;
    background: #14161e;
    border: 1px solid #232733;
    border-radius: 10px;
    padding: 12px 16px;
  }
  .examples h2 { font-size: 14px; margin: 0 0 8px; }
  .examples ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
  .examples li { font-size: 12px; color: #9aa1b3; }
</style>
