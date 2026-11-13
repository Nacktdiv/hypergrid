import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { InteractionManager } from "react-native";

import { SlideCommit } from "@/components/ui/slide-commit";
import { useOptionalTheme } from "@/contexts/theme-context";
import type { PlannedRoute } from "@/services/api/routing.service";

export interface PlayButtonProps {
  activeRoute?: PlannedRoute | null;
  onStartRide?: () => void;
}

export function PlayButton({ activeRoute, onStartRide }: PlayButtonProps) {
  const router = useRouter();
  const { colors } = useOptionalTheme();
  const [sliderKey, setSliderKey] = useState(0);

  const handleDone = useCallback(() => {
    if (onStartRide) {
      onStartRide();
    } else if (activeRoute) {
      router.push({
        pathname: "/ride",
        params: {
          destinationName: activeRoute.destinationName,
          destinationLat: String(activeRoute.destinationPoint.latitude),
          destinationLon: String(activeRoute.destinationPoint.longitude),
          routeCoords: JSON.stringify(activeRoute.coordinates),
          distanceMeters: String(activeRoute.distanceMeters),
          durationSeconds: String(activeRoute.durationSeconds),
        },
      });
    } else {
      router.push("/ride");
    }

    InteractionManager.runAfterInteractions(() => {
      setSliderKey((prev) => prev + 1);
    });
  }, [activeRoute, onStartRide, router]);

  return (
    <SlideCommit
      key={sliderKey}
      label={
        activeRoute ? `Start: ${activeRoute.destinationName}` : "Start Ride"
      }
      doneLabel="Starting..."
      errorLabel="Cannot start ride"
      onDone={handleDone}
      trackColor={colors.brand}
      handleColor={colors.brand}
      successColor="#10B981"
      height={54}
      radius={27}
    />
  );
}
