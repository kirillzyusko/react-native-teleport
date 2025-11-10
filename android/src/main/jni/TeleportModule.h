#pragma once

#include <ReactCommon/BindingsInstallerHolder.h>
#include <react/fabric/JFabricUIManager.h>
#include <fbjni/fbjni.h>
#include <TeleportCommitHook.h>

#include <string>

namespace teleport
{

  using namespace facebook;
  using namespace facebook::jni;

  class TeleportModule : public jni::HybridClass<TeleportModule>
  {
  public:
    static auto constexpr kJavaDescriptor =
        "Lcom/teleport/TeleportModule;";
    static jni::local_ref<jhybriddata> initHybrid(jni::alias_ref<jhybridobject> jThis);
    static void registerNatives();

    ~TeleportModule();

  private:
    friend HybridBase;
    jni::global_ref<TeleportModule::javaobject> javaPart_;
    std::shared_ptr<TeleportCommitHook> commitHook_;

    explicit TeleportModule(jni::alias_ref<TeleportModule::javaobject> jThis);

    void createCommitHook(
        jni::alias_ref<facebook::react::JFabricUIManager::javaobject> fabricUIManager);

    jni::local_ref<BindingsInstallerHolder::javaobject> getBindingsInstallerCxx();
  };

}