<script lang="ts">
  let selectedUniverse = $state(1);
  import { consoleStore as store } from '../console.svelte';

  const frame = () => store.snap.dmx.frames[selectedUniverse - 1] ?? new Uint8Array(512);
  const activeSlots = $derived(
    store.snap.dmx.fixtureOutputs
      .filter((item) => item.fixture.universe === selectedUniverse)
      .flatMap((item) => item.slots.map((slot) => ({ ...slot, fixture: item })))
      .sort((a, b) => a.absolute - b.absolute),
  );
</script>

<section class="monitor">
  <header>
    <h2>DMX 输出监视（活动 v{store.snap.patchVersion}）</h2>
    <div class="universes">
      {#each [1, 2, 3, 4] as universe (universe)}
        <button class:on={selectedUniverse === universe} onclick={() => (selectedUniverse = universe)}>U{universe}</button>
      {/each}
    </div>
  </header>
  <p class="meta">每宇宙实时生成 512 字节帧，不含起始码；未列出的余槽均为 0。</p>

  <div class="fixtures">
    {#each store.snap.dmx.fixtureOutputs as item (item.fixture.id)}
      <span>{item.fixture.name || item.fixture.id}: {item.level.toFixed(1)}% · U{item.fixture.universe} {item.start}-{item.end}</span>
    {/each}
  </div>

  <div class="slots">
    {#each activeSlots as slot (slot.fixture.fixture.id + '-' + slot.absolute)}
      <div><strong>{slot.absolute}</strong><b>{slot.value}</b><em>{slot.fixture.fixture.name || slot.fixture.fixture.id} · {slot.source}</em></div>
    {/each}
  </div>
  <p class="frame">帧字节长度：{frame().length}</p>
</section>

<style>
  .monitor { grid-column: 1 / -1; background: #14161e; border: 1px solid #232733; border-radius: 10px; padding: 12px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  h2 { font-size: 15px; margin: 0; }
  .universes { display: flex; gap: 6px; }
  .universes button.on { background: #1f5ed8; border-color: #3d7bff; color: #fff; }
  .meta, .frame { color: #7d8598; font-size: 11px; margin: 6px 0; }
  .fixtures { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .fixtures span { background: #171a22; border: 1px solid #2a2f3d; border-radius: 99px; padding: 3px 8px; font-size: 11px; }
  .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; max-height: 180px; overflow: auto; }
  .slots div { display: grid; grid-template-columns: 42px 48px 1fr; gap: 6px; align-items: center; background: #171a22; border-radius: 6px; padding: 4px 6px; }
  .slots strong { color: #9db8ff; font-size: 12px; }
  .slots b { color: #7be3a6; font-size: 12px; }
  .slots em { font-style: normal; color: #7d8598; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
