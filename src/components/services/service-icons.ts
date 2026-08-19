import {
  IconBlueprint,
  IconColumns,
  IconCube,
  IconHardHat,
  IconHeadset,
  IconHelp,
  IconWrench,
} from '@/components/ui/icons';
import type { ServiceIconName } from '@/lib/content/services';

/** Association icône ↔ service du catalogue (bibliothèque unique du projet). */
export const SERVICE_ICONS: Record<ServiceIconName, typeof IconBlueprint> = {
  blueprint: IconBlueprint,
  columns: IconColumns,
  wrench: IconWrench,
  cube: IconCube,
  headset: IconHeadset,
  hardhat: IconHardHat,
  help: IconHelp,
};
