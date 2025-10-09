import { TurboModuleRegistry } from "react-native";

import type { TurboModule } from "react-native";

export interface Spec extends TurboModule {
  install(): void;
}

export default TurboModuleRegistry.get<Spec>("Teleport");
