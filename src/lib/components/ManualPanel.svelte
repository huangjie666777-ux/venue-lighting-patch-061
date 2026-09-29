<script lang="ts">
  import { consoleStore as store } from '../console.svelte';
  import { CHANNEL_COUNT } from '../types';

  const channels = Array.from({ length: CHANNEL_COUNT }, (_, i) => i + 1);
</script>

<section class="panel">
  <header><h2>手动接管（12 灯）</h2></header>
  <div class="chs">
    {#each channels as ch (ch)}
    {@const i = ch - 1}
      <div class="ch" class:taken={store.snap.takeover[i]}>
        <button
          class="take"
          class:on={store.snap.takeover[i]}
          onclick={() => store.toggleTakeover(ch)}
        >
          #{ch}{store.snap.takeover[i] ? ' · 接管中' : ''}
        </button>
        <input
          type="range" min="0" max="100" step="1"
          disabled={!store.snap.takeover[i]}
          value={Math.round(store.snap.takeoverLevels[i])}
          oninput={(e) => store.setTakeoverLevel(ch, Number(e.currentTarget.value))}
        />
        <span class="val">
          手 {Math.round(store.snap.takeover[i] ? store.snap.takeoverLevels[i] : store.snap.baseLevels[i])}
          / 出 {Math.round(store.snap.outputLevels[i])}
        </span>
      </div>
    {/each}
  </div>
  <p class="note">接管期间基础渐变照常推进；释放后立即跟随当时基础亮度。输出 =（接管或基础）× 总控，黑场强制 0。</p>
</section>

<style>
  .panel { display: flex; flex-direction: column; gap: 8px; }
  header h2 { font-size: 14px; margin: 0; color: #c9cedd; }
  .chs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 14px; }
  .ch { display: grid; grid-template-columns: 86px 1fr 96px; align-items: center; gap: 8px; }
  .ch.taken .take { border-color: #ff5d73; color: #ffb7c0; }
  .take { padding: 4px 6px; font-size: 11px; text-align: center; }
  .take.on { background: #4a1d25; }
  .val { font-size: 10px; color: #7d8598; text-align: right; }
  .note { font-size: 11px; color: #7d8598; margin: 0; }
</style>
