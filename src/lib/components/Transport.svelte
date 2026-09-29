<script lang="ts">
  import { consoleStore as store } from '../console.svelte';

  const fmt = (v: number | null) =>
    v === null ? '—' : v <= 0 ? '0.0' : v.toFixed(1);
</script>

<section class="panel">
  <div class="now">
    <div class="cuebox">
      <span class="label">当前 Cue</span>
      <strong>
        {#if store.snap.currentIndex >= 0}
          {store.snap.currentIndex + 1}. {store.cues[store.snap.currentIndex]?.name}
        {:else}
          （未执行 · 全零）
        {/if}
      </strong>
    </div>
    <div class="cuebox">
      <span class="label">下一 Cue</span>
      <strong>
        {#if store.snap.nextIndex >= 0}
          {store.snap.nextIndex + 1}. {store.cues[store.snap.nextIndex]?.name}
        {:else}
          （末项）
        {/if}
      </strong>
    </div>
  </div>

  <div class="progress">
    <div class="bar">
      <div class="fill fade" style:width={store.snap.fadeProgress * 100 + '%'}></div>
    </div>
    <div class="readouts">
      <span>渐变 {store.snap.fading ? store.snap.fadeProgress.toFixed(2) : '完成'}</span>
      <span>跟随倒计时 {fmt(store.snap.followRemaining)}s</span>
      {#if store.snap.paused}<span class="paused">已暂停</span>{/if}
    </div>
  </div>

  <div class="buttons">
    <button class="primary" onclick={() => store.go()} disabled={!store.canRun || store.snap.paused}>GO ▶</button>
    {#if store.snap.paused}
      <button onclick={() => store.resume()} disabled={!store.snap.running}>继续</button>
    {:else}
      <button onclick={() => store.pause()} disabled={!store.snap.running}>暂停</button>
    {/if}
    <button class="danger" onclick={() => store.stop()} disabled={!store.snap.running}>停止归零</button>
  </div>

  <div class="master">
    <label>
      总控 {Math.round(store.snap.master * 100)}%
      <input
        type="range" min="0" max="100" step="1"
        value={Math.round(store.snap.master * 100)}
        oninput={(e) => store.setMaster(Number(e.currentTarget.value) / 100)}
      />
    </label>
    <button class="blackout" class:on={store.snap.blackout} onclick={() => store.toggleBlackout()}>
      {store.snap.blackout ? '解除黑场' : '黑场 BLACKOUT'}
    </button>
  </div>

  {#if store.errors.length > 0 && !store.running}
    <p class="block">节目单存在 {store.errors.length} 处非法输入，修正后才能 GO。</p>
  {/if}
</section>

<style>
  .panel { display: flex; flex-direction: column; gap: 10px; }
  .now { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cuebox { background: #171a22; border: 1px solid #2a2f3d; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
  .label { font-size: 11px; color: #7d8598; }
  .cuebox strong { font-size: 13px; color: #e6e9f2; }
  .progress { display: flex; flex-direction: column; gap: 4px; }
  .bar { height: 8px; background: #171a22; border-radius: 5px; overflow: hidden; }
  .fill { height: 100%; transition: none; }
  .fill.fade { background: linear-gradient(90deg, #5b8cff, #7be3a6); }
  .readouts { display: flex; gap: 14px; font-size: 12px; color: #9aa1b3; }
  .paused { color: #ffd166; }
  .buttons { display: flex; gap: 8px; }
  .buttons button { flex: 1; padding: 10px 0; font-size: 14px; }
  button.primary { background: #1f5ed8; border-color: #3d7bff; color: #fff; font-weight: 600; }
  button.danger { background: #4a1d25; border-color: #b23b4b; color: #ffb7c0; }
  .master { display: flex; align-items: center; gap: 14px; }
  .master label { flex: 1; display: flex; align-items: center; gap: 10px; font-size: 12px; color: #9aa1b3; }
  .master input[type='range'] { flex: 1; }
  button.blackout { background: #241f12; border-color: #8a7420; color: #ffd166; padding: 8px 12px; }
  button.blackout.on { background: #7a1f28; border-color: #ff5d73; color: #fff; }
  .block { margin: 0; color: #ff8b98; font-size: 12px; }
</style>
