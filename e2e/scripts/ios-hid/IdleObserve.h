#if TARGET_OS_SIMULATOR
// Diagnostic observation only. These functions never wait for either reply.
FOUNDATION_EXPORT void TeleportIdleRememberApplication(NSObject *application);
FOUNDATION_EXPORT void TeleportIdleObserveInput(NSString *route);
#endif
