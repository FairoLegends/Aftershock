import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {DC1_SafetyThenRoom} from "./DC1_SafetyThenRoom"
import {DC2_QuakeStarts} from "./DC2_QuakeStarts"
import {DC3_ArrowAndTakeCover} from "./DC3_ArrowAndTakeCover"
import {DC4_StandUpDrainsAndGameOver} from "./DC4_StandUpDrainsAndGameOver"
import {DC5_QuakeEndsScore} from "./DC5_QuakeEndsScore"
import {DC6_DangerZoneDrains} from "./DC6_DangerZoneDrains"
import {DC7_LanguagesAndRestart} from "./DC7_LanguagesAndRestart"
import {DC8_BedTrap} from "./DC8_BedTrap"
import {DC9_TwoTables} from "./DC9_TwoTables"
import {DC10_ScanPathEdge} from "./DC10_ScanPathEdge"
import {DC11_Aftershock} from "./DC11_Aftershock"
import {DC12_Levels} from "./DC12_Levels"
import {DC13_FallingObjects} from "./DC13_FallingObjects"
import {DC14_WallsAndDoor} from "./DC14_WallsAndDoor"
import {DC15_Evacuation} from "./DC15_Evacuation"
import {DC16_HoldOn} from "./DC16_HoldOn"
import {DC17_CalibrateAndBest} from "./DC17_CalibrateAndBest"
import {DC18_TvTopple} from "./DC18_TvTopple"
import {DC19_EducationCards} from "./DC19_EducationCards"

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
    {id: "dc7-languages-and-restart", typename: DC7_LanguagesAndRestart.getTypeName()},
    {id: "dc8-bed-trap", typename: DC8_BedTrap.getTypeName()},
    {id: "dc9-two-tables", typename: DC9_TwoTables.getTypeName()},
    {id: "dc10-scan-path-edge", typename: DC10_ScanPathEdge.getTypeName()},
    {id: "dc11-aftershock", typename: DC11_Aftershock.getTypeName()},
    {id: "dc12-levels", typename: DC12_Levels.getTypeName()},
    {id: "dc13-falling-objects", typename: DC13_FallingObjects.getTypeName()},
    {id: "dc14-walls-and-door", typename: DC14_WallsAndDoor.getTypeName()},
    {id: "dc15-evacuation", typename: DC15_Evacuation.getTypeName()},
    {id: "dc16-hold-on", typename: DC16_HoldOn.getTypeName()},
    {id: "dc17-calibrate-and-best", typename: DC17_CalibrateAndBest.getTypeName()},
    {id: "dc18-tv-topple", typename: DC18_TvTopple.getTypeName()},
    {id: "dc19-education-cards", typename: DC19_EducationCards.getTypeName()}
  ]
}
