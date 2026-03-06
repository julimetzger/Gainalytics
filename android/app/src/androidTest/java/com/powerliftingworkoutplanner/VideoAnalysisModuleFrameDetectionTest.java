package com.powerliftingworkoutplanner;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.facebook.react.bridge.ReactApplicationContext;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@RunWith(AndroidJUnit4.class)
public class VideoAnalysisModuleFrameDetectionTest {

    @Test
    public void initialTop3ContainsExpectedPlateCenter_forVideo1T0() throws Exception {
        FrameExpectation expectation = new FrameExpectation("hough-frames/video1_t0.jpg", 238.0, 170.0, 52.0, 70.0);
        assertTopThreeContainsExpectedPlate(expectation);
    }

    @Test
    public void initialTop3ContainsExpectedPlateCenter_forVideo2T0() throws Exception {
        FrameExpectation expectation = new FrameExpectation("hough-frames/video2_t0.jpg", 70.0, 88.0, 52.0, 72.0);
        assertTopThreeContainsExpectedPlate(expectation);
    }

    private void assertTopThreeContainsExpectedPlate(FrameExpectation expectation) throws Exception {
        VideoAnalysisModule module = createModule();
        Bitmap frame = loadAssetBitmap(expectation.assetPath);
        assertNotNull("Fixture bitmap must be readable", frame);

        VideoAnalysisModule.FrameHoughDebugResult result =
            module.detectPlateFromBitmapForTest(frame, expectation.expectedX, expectation.expectedY, expectation.expectedRadius);
        List<VideoAnalysisModule.FrameHoughDebugCircle> sourceCandidates =
            !result.rankedHoughCandidates.isEmpty() ? result.rankedHoughCandidates : result.initialCircles;
        assertTrue(
            "Expected at least one scored Hough candidate (ranked=" + result.rankedHoughCandidates.size() + ", initial=" + result.initialCircles.size() + ", raw=" + result.houghCandidates.size() + ")",
            !sourceCandidates.isEmpty()
        );

        int topCount = Math.min(3, sourceCandidates.size());
        boolean hasExpectedCircle = false;
        List<String> topThree = new ArrayList<>();
        for (int index = 0; index < topCount; index++) {
            VideoAnalysisModule.FrameHoughDebugCircle circle = sourceCandidates.get(index);
            double distance = Math.hypot(circle.x - expectation.expectedX, circle.y - expectation.expectedY);
            topThree.add(
                "idx=" + index +
                    " x=" + round(circle.x) +
                    " y=" + round(circle.y) +
                    " r=" + round(circle.radius) +
                    " score=" + round(circle.score) +
                    " dist=" + round(distance)
            );
            if (distance <= expectation.maxDistancePx) {
                hasExpectedCircle = true;
            }
        }

        assertTrue(
            "Expected top-3 to contain plate-near circle for " + expectation.assetPath + " but got " + topThree,
            hasExpectedCircle
        );
    }

    private VideoAnalysisModule createModule() {
        ReactApplicationContext reactContext = new ReactApplicationContext(ApplicationProvider.getApplicationContext());
        return new VideoAnalysisModule(reactContext);
    }

    private Bitmap loadAssetBitmap(String assetPath) throws Exception {
        try (InputStream inputStream = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(assetPath)) {
            return BitmapFactory.decodeStream(inputStream);
        }
    }

    private double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static class FrameExpectation {
        final String assetPath;
        final double expectedX;
        final double expectedY;
        final double expectedRadius;
        final double maxDistancePx;

        FrameExpectation(String assetPath, double expectedX, double expectedY, double expectedRadius, double maxDistancePx) {
            this.assetPath = assetPath;
            this.expectedX = expectedX;
            this.expectedY = expectedY;
            this.expectedRadius = expectedRadius;
            this.maxDistancePx = maxDistancePx;
        }
    }
}
