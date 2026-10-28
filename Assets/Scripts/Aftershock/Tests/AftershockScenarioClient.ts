import {DefaultScenarioManager} from "Leaf.lspkg/Scenarios/scenario/manager/DefaultLeafScenarioManager"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

const LOG = "[AftershockScenarioClient]"
const GAP_MS = 1000

// Runs every registered LEAF scenario in index order on Lens start and logs a
// summary. Lives on LeafAutoRun, which stays disabled except for test runs.
@component
export class AftershockScenarioClient extends BaseScriptComponent {
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.runAll()
    })
  }

  private async runAll(): Promise<void> {
    const manager = DefaultScenarioManager.getInstance()
    const ids = manager.listScenarioIds()
    print(`${LOG} running ${ids.length} scenarios: ${ids.join(", ")}`)
    const failed: string[] = []
    for (const id of ids) {
      await sleep(GAP_MS)
      try {
        // The manager logs PASSED/FAILED itself and throws on a failure.
        await manager.startScenario(id)
      } catch (e) {
        failed.push(id)
      }
    }
    if (failed.length === 0) {
      print(`${LOG} [SUCCESS] All ${ids.length} scenarios passed.`)
    } else {
      print(`${LOG} [FAILURE] ${failed.length} of ${ids.length} failed: ${failed.join(", ")}`)
    }
  }
}
