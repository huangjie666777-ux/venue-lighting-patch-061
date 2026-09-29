<script lang="ts">
  import { consoleStore as store } from '../console.svelte';

  let { running = false }: { running?: boolean } = $props();

  const cueErrors = (id: string) => store.errors.filter((e) => e.cueId === id);
</script>

<section class="panel">
  <header class="panel-head">
    <h2>节目单 Cue</h2>
    <button onclick={() => store.addCue()} disabled={running}>＋ 新增</button>
  </header>
  <ol class="cues">
    {#each store.cues as cue, i (cue.id)}
      {@const isCurrent = store.snap.running && store.snap.currentIndex === i}
      {@const isNext = store.snap.running && store.snap.nextIndex === i}
      <li class="cue" class:selected={store.selectedId === cue.id} class:current={isCurrent}>
        <button class="cue-main" onclick={() => store.select(cue.id)}>
          <span class="idx">{i + 1}</span>
          <span class="names">
            <strong>{cue.name || '(未命名)'}</strong>
            <span class="meta">
              记录 {Object.keys(cue.channels).length} 灯
              {#if cue.follow !== undefined} · 跟随 {cue.follow}s{/if}
            </span>
            {#if isCurrent}<span class="tag cur">当前</span>{/if}
            {#if isNext}<span class="tag next">下一</span>{/if}
          </span>
        </button>
        {#if cueErrors(cue.id).length > 0}
          <span class="err-dot" title={cueErrors(cue.id).map((e) => e.message).join('；')}>!</span>
        {/if}
        <span class="cue-actions">
          <button title="上移" disabled={running || i === 0} onclick={() => store.move(cue.id, -1)}>↑</button>
          <button title="下移" disabled={running || i === store.cues.length - 1} onclick={() => store.move(cue.id, 1)}>↓</button>
          <button title="复制" disabled={running} onclick={() => store.duplicateCue(cue.id)}>⧉</button>
          <button
            title={running ? '运行中可跳场到此 Cue' : '删除'}
            class={running ? 'jump' : 'del'}
            onclick={() => (running ? store.jump(i) : store.deleteCue(cue.id))}
          >
            {running ? '跳' : '删'}
          </button>
        </span>
      </li>
    {/each}
  </ol>
</section>

<style>
  .panel { display: flex; flex-direction: column; min-height: 0; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  h2 { font-size: 14px; margin: 0; color: #c9cedd; }
  .cues { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .cue {
    display: flex; align-items: center; gap: 6px;
    border: 1px solid #2a2f3d; border-radius: 8px; background: #171a22;
  }
  .cue.selected { border-color: #5b8cff; }
  .cue.current { border-color: #37c871; box-shadow: 0 0 0 1px #37c871 inset; }
  .cue-main { flex: 1; display: flex; align-items: center; gap: 10px; background: none; border: 0; color: inherit; text-align: left; padding: 8px; cursor: pointer; }
  .idx { width: 22px; color: #7d8598; font-size: 12px; }
  .names { display: flex; flex-direction: column; gap: 2px; }
  .meta { font-size: 11px; color: #7d8598; }
  .tag { font-size: 10px; padding: 0 5px; border-radius: 4px; margin-left: 6px; }
  .tag.cur { background: #14432a; color: #7be3a6; }
  .tag.next { background: #23345c; color: #9db8ff; }
  .cue-actions { display: flex; gap: 3px; padding-right: 6px; }
  .cue-actions button { padding: 3px 6px; font-size: 12px; }
  .err-dot { width: 18px; height: 18px; border-radius: 50%; background: #b23b4b; color: #fff; font-size: 11px; display: grid; place-items: center; }
  button.jump { color: #9db8ff; }
  button.del { color: #ff8b98; }
</style>
