package com.teleport

import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.fabric.FabricUIManager
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType

@ReactModule(name = TeleportModule.NAME)
class TeleportModule(reactContext: ReactApplicationContext) : NativeTeleportSpec(reactContext) {
  @DoNotStrip
  @Suppress("unused")
  private var mHybridData: HybridData = initHybrid()

  private external fun initHybrid(): HybridData
  private external fun createCommitHook(fabricUIManager: FabricUIManager)

  override fun getName() = NAME

  override fun install() {
    val uiManager =
      UIManagerHelper.getUIManager(
        reactApplicationContext,
        UIManagerType.FABRIC
      ) as FabricUIManager
    createCommitHook(uiManager)
  }

  companion object {
    const val NAME = "Teleport"
  }
}
