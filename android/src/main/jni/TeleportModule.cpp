#include <react/fabric/Binding.h>
#include <react/renderer/scheduler/Scheduler.h>

#include "TeleportModule.h"

namespace teleport
{

  using namespace facebook;
  using namespace react;

  TeleportModule::TeleportModule(jni::alias_ref<TeleportModule::javaobject> jThis)
      : javaPart_(jni::make_global(jThis))
  {
  }

  TeleportModule::~TeleportModule() {}

  void TeleportModule::registerNatives()
  {
    registerHybrid(
        {makeNativeMethod("initHybrid", TeleportModule::initHybrid),
         makeNativeMethod("createCommitHook", TeleportModule::createCommitHook)});
  }

  void TeleportModule::createCommitHook(jni::alias_ref<facebook::react::JFabricUIManager::javaobject> fabricUIManager)
  {
    const auto &uiManager =
        fabricUIManager->getBinding()->getScheduler()->getUIManager();
    commitHook_ = std::make_shared<TeleportCommitHook>(uiManager);
  }

  jni::local_ref<TeleportModule::jhybriddata> TeleportModule::initHybrid(jni::alias_ref<jhybridobject> jThis)
  {
    return makeCxxInstance(jThis);
  }

}
