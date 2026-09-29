<script lang="ts">
  import { consoleStore as store } from '../console.svelte';
</script>

<section class="patch">
  <header>
    <div>
      <h2>巡演场地配接</h2>
      <p>活动版本 v{store.activePatch.version} · {store.patchDirty ? '草稿未应用' : '草稿与活动一致'} · 运行中也可改草稿</p>
    </div>
    <div class="actions">
      <button onclick={() => store.applyPatch()} disabled={!store.patchDirty || store.patchErrors.length > 0}>应用草稿</button>
      <button onclick={() => store.resetPatchDraft()} disabled={!store.patchDirty}>放弃</button>
    </div>
  </header>

  {#if store.patchErrors.length > 0}
    <p class="errors">配接草稿有 {store.patchErrors.length} 处错误；应用前不会影响活动输出。</p>
  {/if}

  <div class="grid">
    <div class="box">
      <div class="box-head"><h3>灯型</h3><button onclick={() => store.addFixtureType()}>＋ 灯型</button></div>
      {#each store.draftPatch.types as type (type.id)}
        {@const errs = store.patchError(type.id)}
        <article class="card" class:bad={errs.length > 0}>
          <div class="line">
            <input value={type.name} oninput={(e) => store.updateFixtureType(type.id, { name: e.currentTarget.value })} aria-label="灯型名称" />
            <button class="del" onclick={() => store.deleteFixtureType(type.id)}>删</button>
          </div>
          <label>ID<input value={type.id} class:bad={store.patchError(type.id, 'id').length > 0} oninput={(e) => store.updateFixtureType(type.id, { id: e.currentTarget.value })} /></label>
          <div class="triple">
            <label>槽数<input type="number" min="1" step="1" value={type.slots} class:bad={store.patchError(type.id, 'slots').length > 0} oninput={(e) => store.updateFixtureType(type.id, { slots: e.currentTarget.valueAsNumber })} /></label>
            <label>位宽
              <select value={type.resolution} onchange={(e) => store.updateFixtureType(type.id, { resolution: Number(e.currentTarget.value) as 8 | 16 })}>
                <option value={8}>8</option><option value={16}>16</option>
              </select>
            </label>
            <label>粗槽<input type="number" min="0" step="1" value={type.coarseOffset} class:bad={store.patchError(type.id, 'coarseOffset').length > 0} oninput={(e) => store.updateFixtureType(type.id, { coarseOffset: e.currentTarget.valueAsNumber })} /></label>
          </div>
          {#if type.resolution === 16}
            <label>细槽<input type="number" min="0" step="1" value={type.fineOffset ?? 0} class:bad={store.patchError(type.id, 'fineOffset').length > 0} oninput={(e) => store.updateFixtureType(type.id, { fineOffset: e.currentTarget.valueAsNumber })} /></label>
          {/if}
          <label>常量 偏移:值，逗号分隔<input value={store.constantsText(type)} class:bad={store.patchError(type.id, 'constants').length > 0} title={errs.map((e) => e.message).join('；')} oninput={(e) => store.setConstants(type.id, e.currentTarget.value)} placeholder="例：2:255" /></label>
          {#if errs.length > 0}<small>{errs.map((e) => e.message).join('；')}</small>{/if}
        </article>
      {/each}
    </div>

    <div class="box">
      <div class="box-head"><h3>灯具</h3><button onclick={() => store.addFixture()}>＋ 灯具</button></div>
      {#each store.draftPatch.fixtures as fixture (fixture.id)}
        {@const errs = store.patchError(fixture.id)}
        <article class="card" class:bad={errs.length > 0}>
          <div class="line">
            <input value={fixture.name} oninput={(e) => store.updateFixture(fixture.id, { name: e.currentTarget.value })} aria-label="灯具名称" />
            <button class="del" onclick={() => store.deleteFixture(fixture.id)}>删</button>
          </div>
          <label>ID<input value={fixture.id} class:bad={store.patchError(fixture.id, 'id').length > 0} oninput={(e) => store.updateFixture(fixture.id, { id: e.currentTarget.value })} /></label>
          <label>灯型
            <select value={fixture.typeId} class:bad={store.patchError(fixture.id, 'typeId').length > 0} onchange={(e) => store.updateFixture(fixture.id, { typeId: e.currentTarget.value })}>
              {#each store.draftPatch.types as type (type.id)}<option value={type.id}>{type.name || type.id}</option>{/each}
            </select>
          </label>
          <div class="triple">
            <label>宇宙<input type="number" min="1" max="4" step="1" value={fixture.universe} class:bad={store.patchError(fixture.id, 'universe').length > 0} oninput={(e) => store.updateFixture(fixture.id, { universe: e.currentTarget.valueAsNumber })} /></label>
            <label>地址<input type="number" min="1" max="512" step="1" value={fixture.address} class:bad={store.patchError(fixture.id, 'address').length > 0} oninput={(e) => store.updateFixture(fixture.id, { address: e.currentTarget.valueAsNumber })} /></label>
            <label>上限<input type="number" min="0" max="100" step="1" value={fixture.maxLevel} class:bad={store.patchError(fixture.id, 'maxLevel').length > 0} oninput={(e) => store.updateFixture(fixture.id, { maxLevel: e.currentTarget.valueAsNumber })} /></label>
          </div>
          <label>逻辑灯编号（逗号/空格）<input value={fixture.logicalChannels.join(', ')} class:bad={store.patchError(fixture.id, 'logicalChannels').length > 0} oninput={(e) => store.setLogicalChannels(fixture.id, e.currentTarget.value)} /></label>
          {#if errs.length > 0}<small>{errs.map((e) => e.message).join('；')}</small>{/if}
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .patch { grid-column: 1 / -1; background: #14161e; border: 1px solid #232733; border-radius: 10px; padding: 12px; }
  header { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  h2 { font-size: 15px; margin: 0; }
  header p { margin: 2px 0 0; font-size: 11px; color: #7d8598; }
  .actions { display: flex; gap: 6px; }
  .errors { color: #ff8b98; font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .box-head { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
  h3 { font-size: 13px; margin: 0; }
  .card { border: 1px solid #2a2f3d; border-radius: 8px; padding: 8px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 5px; }
  .card.bad { border-color: #b23b4b; background: #1d151a; }
  .line { display: grid; grid-template-columns: 1fr auto; gap: 6px; }
  .triple { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  label { font-size: 10px; color: #7d8598; display: flex; flex-direction: column; gap: 2px; }
  select { background: #0e1016; color: #e6e9f2; border: 1px solid #323846; border-radius: 5px; padding: 4px; }
  input.bad { border-color: #ff5d73; background: #2a151a; }
  small { color: #ff8b98; font-size: 10px; line-height: 1.35; }
  .del { color: #ff8b98; }
</style>
