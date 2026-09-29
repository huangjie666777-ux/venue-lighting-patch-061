<script lang="ts">
  import { consoleStore as store } from '../console.svelte';
  import { CHANNEL_COUNT } from '../types';

  let { running = false }: { running?: boolean } = $props();
  const channels = Array.from({ length: CHANNEL_COUNT }, (_, i) => i + 1);

  const numField = (cueId: string, ch: number, key: 'level' | 'up' | 'down', value: string) =>
    store.setChannel(cueId, ch, { [key]: value });
</script>

<section class="panel">
  <header class="panel-head"><h2>Cue 编辑{running ? '（运行中锁定）' : ''}</h2></header>
  {#if store.selected}
    {@const cue = store.selected}
    <div class="form">
      <label class="row">
        <span>名称（唯一）</span>
        <input
          value={cue.name}
          disabled={running}
          class:bad={!!store.fieldError(cue.id, 'name')}
          oninput={(e) => store.rename(cue.id, e.currentTarget.value)}
        />
        {#if store.fieldError(cue.id, 'name')}<em>{store.fieldError(cue.id, 'name')}</em>{/if}
      </label>

      <div class="grid-head">
        <span>灯</span><span>亮度 0-100</span><span>升光 s</span><span>降光 s</span><span></span>
      </div>
      {#each channels as ch (ch)}
        {@const rec = cue.channels[String(ch)]}
        <div class="ch-row" class:recorded={!!rec}>
          <span class="ch-no">#{ch}</span>
          {#if rec}
            <input
              type="number" min="0" max="100" step="1" value={rec.level}
              disabled={running}
              class:bad={!!store.fieldError(cue.id, `ch.${ch}.level`)}
              title={store.fieldError(cue.id, `ch.${ch}.level`)}
              oninput={(e) => numField(cue.id, ch, 'level', e.currentTarget.value)}
            />
            <input
              type="number" min="0" step="0.1" value={rec.up}
              disabled={running}
              class:bad={!!store.fieldError(cue.id, `ch.${ch}.up`)}
              title={store.fieldError(cue.id, `ch.${ch}.up`)}
              oninput={(e) => numField(cue.id, ch, 'up', e.currentTarget.value)}
            />
            <input
              type="number" min="0" step="0.1" value={rec.down}
              disabled={running}
              class:bad={!!store.fieldError(cue.id, `ch.${ch}.down`)}
              title={store.fieldError(cue.id, `ch.${ch}.down`)}
              oninput={(e) => numField(cue.id, ch, 'down', e.currentTarget.value)}
            />
            <button class="link" disabled={running} onclick={() => store.clearChannel(cue.id, ch)}>改为继承</button>
          {:else}
            <span class="inherit">未记录 · 继承前序 Cue</span>
            <button class="link" disabled={running} onclick={() => store.setChannel(cue.id, ch, { level: '0' })}>记录</button>
          {/if}
        </div>
      {/each}

      <label class="row follow">
        <span>跟随等待 s（留空 = 不跟随）</span>
        <input
          type="number" min="0" step="0.1" placeholder="不跟随"
          value={cue.follow ?? ''}
          disabled={running}
          class:bad={!!store.fieldError(cue.id, 'follow')}
          oninput={(e) => store.setFollow(cue.id, e.currentTarget.value)}
        />
        {#if store.fieldError(cue.id, 'follow')}<em>{store.fieldError(cue.id, 'follow')}</em>{/if}
      </label>
      <p class="hint">提示：亮度填 0 表示“显式熄灭”，与留空继承不同。</p>
    </div>
  {:else}
    <p class="empty">选择或新建一个 Cue。</p>
  {/if}
</section>

<style>
  .panel { display: flex; flex-direction: column; min-height: 0; }
  .panel-head { margin-bottom: 8px; }
  h2 { font-size: 14px; margin: 0; color: #c9cedd; }
  .form { overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
  .row { display: grid; grid-template-columns: 160px 1fr; gap: 8px; align-items: center; }
  .row em { grid-column: 2; color: #ff8b98; font-size: 11px; font-style: normal; }
  .grid-head, .ch-row {
    display: grid; grid-template-columns: 42px 1fr 86px 86px 74px; gap: 6px; align-items: center;
  }
  .grid-head { font-size: 11px; color: #7d8598; margin-top: 6px; }
  .ch-row { padding: 2px 0; }
  .ch-row.recorded { background: #171a22; border-radius: 6px; }
  .ch-no { font-size: 12px; color: #9aa1b3; }
  .inherit { grid-column: 2 / 5; color: #626a7d; font-size: 12px; }
  input.bad { border-color: #ff5d73; background: #2a151a; }
  .link { padding: 2px 6px; font-size: 11px; }
  .follow { margin-top: 10px; }
  .hint { font-size: 11px; color: #7d8598; margin: 6px 0 0; }
  .empty { color: #7d8598; font-size: 13px; }
</style>
