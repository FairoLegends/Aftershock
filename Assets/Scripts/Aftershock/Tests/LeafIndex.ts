import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {DC1_SafetyThenRoom} from "./DC1_SafetyThenRoom"
import {DC2_QuakeStarts} from "./DC2_QuakeStarts"
import {DC3_ArrowAndTakeCover} from "./DC3_ArrowAndTakeCover"
import {DC4_StandUpDrainsAndGameOver} from "./DC4_StandUpDrainsAndGameOver"
import {DC5_QuakeEndsScore} from "./DC5_QuakeEndsScore"
import {DC6_DangerZoneDrains} from "./DC6_DangerZoneDrains"
import {DC7_LanguagesAndRestart} from "./DC7_LanguagesAndRestart"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "dc1-safety-then-room", typename: DC1_SafetyThenRoom.getTypeName()},
    {id: "dc2-quake-starts", typename: DC2_QuakeStarts.getTypeName()},
    {id: "dc3-arrow-and-take-cover", typename: DC3_ArrowAndTakeCover.getTypeName()},
    {id: "dc4-stand-up-drains-and-game-over", typename: DC4_StandUpDrainsAndGameOver.getTypeName()},
    {id: "dc5-quake-ends-score", typename: DC5_QuakeEndsScore.getTypeName()},
    {id: "dc6-danger-zone-drains", typename: DC6_DangerZoneDrains.getTypeName()},
    {id: "dc7-languages-and-restart", typename: DC7_LanguagesAndRestart.getTypeName()}
  ]
}
