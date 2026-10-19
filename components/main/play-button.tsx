import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { SlideCommit } from "@/components/ui/slide-commit";

export function PlayButton() {
  const router = useRouter();
  const [sliderKey, setSliderKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setSliderKey((prev) => prev + 1);
    }, [])
  );

  const handleConfirm = async () => {
    // Memberikan jeda singkat 200ms untuk feedback getaran & sensor sync
    await new Promise((resolve) => setTimeout(resolve, 200));
  };

  const handleDone = () => {
    router.push("/ride");
  };

  return (
    <SlideCommit
      key={sliderKey}
      label="Slide to Start Ride"
      doneLabel="Starting Ride..."
      errorLabel="Cannot start ride"
      onConfirm={handleConfirm}
      onDone={handleDone}
      trackColor="#009EFF"
      handleColor="#FFFFFF"
      successColor="#10B981"
      height={54}
      radius={27}
    />
  );
}
