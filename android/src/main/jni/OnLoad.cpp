#include <fbjni/fbjni.h>

#include "TeleportModule.h"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *)
{
  return facebook::jni::initialize(vm, []
                                   { teleport::TeleportModule::registerNatives(); });
}