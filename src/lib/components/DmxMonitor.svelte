<script lang="ts">
  import { consoleStore as store } from '../console.svelte';
  import { DMX_SLOT_COUNT } from '../patch';

  const universes = [1, 2, 3, 4];
  const roleName = { coarse: '粗/调光', fine: '细', constant: '常量' } as const;

  const nonzeroSlots = $derived(
    Array.from({ length: DMX_SLOT_COUNT }, (_, i) => i).filter(
      (slot) => store.patchRender.frames[store.selectedUniverse - 1]?.[slot] !== 0,
    ),
  );
</script>

<section class="panel monitor">
  <header>
    <h2>DMX 实时输出（无起始码）</h2>
    <div class="tabs">
      {#each universes as universe (universe)}
        <button class:on={store.selectedUniverse === universe} onclick={() => store.selectUniverse(universe)}>U{universe}</button>
      {/each}
    </div>
  </header>

  <div class="fixture-outputs">
    {#each store.patchRender.fixtureLevels as item (item.fixtureId)}
      {@const fixture = store.activePatch.config.fixtures.find((f) => f.id === item.fixtureId)}
      <span>{fixture?.name ?? item.fixtureId}：{item.level.toFixed(1)}% / {item.value}</span>
    {/each}
  </div>

  <div class="slots">
    <div class="slot-head"><span>槽</span><span>值</span><span>来源</span></div>
    {#each nonzeroSlots as slot (slot)}
      {@const source = store.patchRender.sources[store.selectedUniverse - 1]?.[slot]}
      <div class="slot-row">
        <strong>{slot + 1}</strong>
        <span>{store.patchRender.frames[store.selectedUniverse - 1]?.[slot]}</span>
        {#if source}
          <span title={`源逻辑灯：${source.logicalChannels.join(', ')}`}>
            {source.fixtureName} · {roleName[source.role]}
          </span>
        {:else}
          <span>未知</span>
        {/if}
      </div>
    {/each}
    {#if nonzeroSlots.length === 0}<p class="empty">本宇宙当前所有槽均为零。</p>{/if}
  </div>
</section>

<style>
  .monitor { gap: 8px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  h2 { font-size: 14px; margin: 0; }
  .tabs { display: flex; gap: 4px; }
  .tabs button { padding: 4px 8px; font-size: 12px; }
  .tabs button.on { background: #1f5ed8; border-color: #3d7bff; color: white; }
  .fixture-outputs { display: flex; flex-direction: column; gap: 3px; max-height: 110px; overflow: auto; }
  .fixture-outputs span { background: #171a22; border-radius: 5px; padding: 3px 6px; font-size: 11px; color: #b8c0d2; }
  .slots { max-height: 260px; overflow: auto; display: flex; flex-direction: column; gap: 3px; }
  .slot-head, .slot-row { display: grid; grid-template-columns: 54px 54px 1fr; gap: 8px; align-items: center; font-size: 11px; }
  .slot-head { color: #7d8598; position: sticky; top: 0; background: #14161e; padding-bottom: 3px; }
  .slot-row { background: #171a22; border-radius: 5px; padding: 3px 6px; }
  .slot-row strong { color: #9db8ff; }
  .slot-row span:last-child { color: #b8c0d2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: #7d8598; font-size: 12px; margin: 8px 0; }
</style>
