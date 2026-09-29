<script lang="ts">
  import { consoleStore as store } from '../console.svelte';
</script>

<section class="panel patch">
  <header>
    <div>
      <h2>巡演场地配接</h2>
      <p>活动版本 v{store.activePatch.version} · {new Date(store.activePatch.publishedAt).toLocaleTimeString()}
        {#if store.draftDirty}<strong class="dirty">草稿未应用</strong>{/if}
      </p>
    </div>
    <div class="actions">
      <button onclick={() => store.applyPatch()}>应用配接</button>
      <button onclick={() => store.revertPatch()} disabled={!store.draftDirty}>还原</button>
    </div>
  </header>
  {#if store.patchMessage}<p class="message" class:bad={store.patchErrors.length > 0}>{store.patchMessage}</p>{/if}

  <div class="blocks">
    <section>
      <div class="block-head"><h3>灯型</h3><button onclick={() => store.addFixtureType()}>＋ 灯型</button></div>
      {#each store.draftPatch.types as type (type.id)}
        <article class="card">
          <div class="line">
            <code>{type.id}</code>
            <input value={type.name} oninput={(e) => store.updateFixtureType(type.id, 'name', e.currentTarget.value)} />
            <button class="del" onclick={() => store.deleteFixtureType(type.id)}>删</button>
          </div>
          <div class="grid type-grid">
            <label>槽数<input type="number" min="1" step="1" value={type.slotCount} class:bad={!!store.patchTypeError(type.id, 'slotCount')} oninput={(e) => store.updateFixtureType(type.id, 'slotCount', e.currentTarget.value)} /></label>
            <label>位宽
              <select value={type.width} onchange={(e) => store.setFixtureTypeWidth(type.id, Number(e.currentTarget.value) as 8 | 16)}>
                <option value={8}>8 位</option>
                <option value={16}>16 位</option>
              </select>
            </label>
            <label>粗槽<input type="number" min="0" step="1" value={type.coarseOffset} class:bad={!!store.patchTypeError(type.id, 'coarseOffset')} oninput={(e) => store.updateFixtureType(type.id, 'coarseOffset', e.currentTarget.value)} /></label>
            {#if type.width === 16}
              <label>细槽<input type="number" min="0" step="1" value={type.fineOffset ?? ''} class:bad={!!store.patchTypeError(type.id, 'fineOffset')} oninput={(e) => store.updateFixtureType(type.id, 'fineOffset', e.currentTarget.value)} /></label>
            {/if}
          </div>
          <label class="full">常量（格式：偏移=值，逗号分隔）
            <input value={store.constantsText(type)} class:bad={!!store.patchTypeError(type.id, 'constants.0') || [ ...store.patchErrors].some((e) => e.typeId === type.id && e.field.startsWith('constants.'))} oninput={(e) => store.setConstants(type.id, e.currentTarget.value)} />
          </label>
          {#each store.patchErrors.filter((e) => e.typeId === type.id) as error (error.field + error.message)}
            <p class="error">{error.message}</p>
          {/each}
        </article>
      {/each}
    </section>

    <section>
      <div class="block-head"><h3>灯具</h3><button onclick={() => store.addFixture()}>＋ 灯具</button></div>
      {#each store.draftPatch.fixtures as fixture (fixture.id)}
        <article class="card">
          <div class="line">
            <code>{fixture.id}</code>
            <input value={fixture.name} oninput={(e) => store.updateFixture(fixture.id, 'name', e.currentTarget.value)} />
            <button class="del" onclick={() => store.deleteFixture(fixture.id)}>删</button>
          </div>
          <div class="grid fixture-grid">
            <label>灯型
              <select value={fixture.typeId} class:bad={!!store.patchFixtureError(fixture.id, 'typeId')} onchange={(e) => store.updateFixture(fixture.id, 'typeId', e.currentTarget.value)}>
                {#each store.draftPatch.types as type (type.id)}<option value={type.id}>{type.name}</option>{/each}
              </select>
            </label>
            <label>宇宙<input type="number" min="1" max="4" step="1" value={fixture.universe} class:bad={!!store.patchFixtureError(fixture.id, 'universe')} oninput={(e) => store.updateFixture(fixture.id, 'universe', e.currentTarget.value)} /></label>
            <label>首址<input type="number" min="1" max="512" step="1" value={fixture.startAddress} class:bad={!!store.patchFixtureError(fixture.id, 'startAddress') || !!store.patchFixtureError(fixture.id, 'addressRange')} title={store.patchFixtureError(fixture.id, 'addressRange')} oninput={(e) => store.updateFixture(fixture.id, 'startAddress', e.currentTarget.value)} /></label>
            <label>上限<input type="number" min="0" max="100" step="1" value={fixture.maxLevel} class:bad={!!store.patchFixtureError(fixture.id, 'maxLevel')} oninput={(e) => store.updateFixture(fixture.id, 'maxLevel', e.currentTarget.value)} /></label>
          </div>
          <label class="full">源逻辑灯（1-12，逗号/空格分隔）
            <input value={store.fixtureLogicalText(fixture)} class:bad={!!store.patchFixtureError(fixture.id, 'logicalChannels')} oninput={(e) => store.setFixtureLogical(fixture.id, e.currentTarget.value)} />
          </label>
          {#each store.patchErrors.filter((e) => e.fixtureId === fixture.id) as error (error.field + error.message + (error.otherFixtureId ?? ''))}
            <p class="error">{error.message}</p>
          {/each}
        </article>
      {/each}
    </section>
  </div>
</section>

<style>
  .patch { gap: 8px; }
  header { display: flex; justify-content: space-between; gap: 10px; align-items: start; }
  h2 { font-size: 14px; margin: 0; }
  header p { margin: 3px 0 0; font-size: 11px; color: #7d8598; display: flex; gap: 8px; flex-wrap: wrap; }
  .dirty { color: #ffd166; }
  .actions { display: flex; gap: 6px; }
  .actions button { padding: 6px 10px; }
  .message { margin: 0; padding: 6px 8px; border-radius: 6px; background: #14352a; color: #7be3a6; font-size: 12px; }
  .message.bad { background: #3a1720; color: #ff8b98; }
  .blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .block-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
  h3 { font-size: 12px; color: #c9cedd; margin: 0; }
  .card { background: #171a22; border: 1px solid #2a2f3d; border-radius: 8px; padding: 7px; margin-bottom: 7px; }
  .line { display: grid; grid-template-columns: 86px 1fr 34px; gap: 5px; align-items: center; }
  code { font-size: 10px; color: #8fa3ff; overflow-wrap: anywhere; }
  .grid { display: grid; gap: 5px; margin-top: 6px; }
  .type-grid { grid-template-columns: repeat(2, 1fr); }
  .fixture-grid { grid-template-columns: 1fr 62px 70px 62px; }
  label { font-size: 10px; color: #7d8598; display: flex; flex-direction: column; gap: 2px; }
  select { width: 100%; background: #0e1016; color: #e6e9f2; border: 1px solid #323846; border-radius: 5px; padding: 4px; font-size: 12px; }
  .full { margin-top: 6px; }
  .del { padding: 3px 6px; color: #ff8b98; }
  input.bad, select.bad { border-color: #ff5d73; background: #2a151a; }
  .error { margin: 4px 0 0; color: #ff8b98; font-size: 10px; }
</style>
