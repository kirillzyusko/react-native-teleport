#if TARGET_OS_SIMULATOR
#import <Foundation/Foundation.h>
#import <objc/message.h>
#import <objc/runtime.h>
#import <dlfcn.h>
#import <mach-o/loader.h>

// The actual Xcode 16.4 arm64 callback descriptor is v16@?0@"NSError"8.
// The older class-dump header's two-argument callback is not this ABI.
typedef void (^TeleportIdleReply)(NSError *error);

@interface TeleportIdleObservation : NSObject
@property(nonatomic, strong) NSObject *process;
@property(nonatomic, copy) NSString *bundle;
@property(nonatomic) int pid;
@property(nonatomic) NSUInteger sequence;
@property(nonatomic) NSUInteger generation;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, NSMutableDictionary *> *pending;
@end
@implementation TeleportIdleObservation
@end

static TeleportIdleObservation *TeleportIdleState(void) {
  static TeleportIdleObservation *state;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    state = [TeleportIdleObservation new];
    state.pending = [NSMutableDictionary dictionary];
  });
  return state;
}

static void TeleportIdleEmit(NSDictionary *fields) {
  TeleportIdleObservation *state = TeleportIdleState();
  @synchronized(state) {
    NSMutableDictionary *record = [fields mutableCopy];
    record[@"version"] = @1;
    record[@"sourceSHA"] = @"__TELEPORT_IDLE_SOURCE_SHA__";
    record[@"sequence"] = @(++state.sequence);
    record[@"uptime"] = @([NSProcessInfo processInfo].systemUptime);
    record[@"wallTime"] = @([NSDate date].timeIntervalSince1970);
    record[@"simulatorUDID"] = [NSProcessInfo processInfo].environment[@"SIMULATOR_UDID"] ?: @"";
    NSData *data = [NSJSONSerialization dataWithJSONObject:record options:NSJSONWritingSortedKeys error:NULL];
    if (data) NSLog(@"[teleport-idle-observe] %@", [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
  }
}

static BOOL TeleportIdleHasEncoding(NSObject *object, SEL selector, const char *encoding) {
  Method method = class_getInstanceMethod(object.class, selector);
  return method && strcmp(method_getTypeEncoding(method), encoding) == 0;
}

static NSString *TeleportIdleFrameworkUUID(NSObject *object, SEL selector) {
  Method method = class_getInstanceMethod(object.class, selector);
  Dl_info image;
  if (!method || !dladdr((const void *)method_getImplementation(method), &image)) return @"";
  const struct mach_header_64 *header = image.dli_fbase;
  if (!header || header->magic != MH_MAGIC_64 || header->cputype != CPU_TYPE_ARM64 ||
      header->ncmds > 128 || header->sizeofcmds > 1024 * 1024) return @"";
  const uint8_t *cursor = (const uint8_t *)(header + 1);
  const uint8_t *end = cursor + header->sizeofcmds;
  for (uint32_t i = 0; i < header->ncmds; i++) {
    if ((size_t)(end - cursor) < sizeof(struct load_command)) return @"";
    const struct load_command *command = (const void *)cursor;
    if (command->cmdsize < sizeof(*command) || command->cmdsize > (size_t)(end - cursor)) return @"";
    if (command->cmd == LC_UUID && command->cmdsize >= sizeof(struct uuid_command)) {
      const struct uuid_command *uuid = (const void *)command;
      return [[NSUUID alloc] initWithUUIDBytes:uuid->uuid].UUIDString;
    }
    cursor += command->cmdsize;
  }
  return @"";
}

static id TeleportIdleObjectGetter(NSObject *object, NSString *name) {
  SEL selector = NSSelectorFromString(name);
  if (!TeleportIdleHasEncoding(object, selector, "@16@0:8")) return nil;
  return ((id (*)(id, SEL))objc_msgSend)(object, selector);
}

void TeleportIdleRememberApplication(NSObject *application) {
  TeleportIdleObservation *state = TeleportIdleState();
  @try {
    // Reuse the application already selected by the ORIGINAL hierarchy route.
    // applicationImpl/currentProcess are cached getters in the captured binary.
    // Do not call activeAppsInfo, .state, .running, launch or a new AX query here.
    NSObject *implementation = TeleportIdleObjectGetter(application, @"applicationImpl");
    NSObject *process = TeleportIdleObjectGetter(implementation, @"currentProcess");
    NSString *bundle = TeleportIdleObjectGetter(implementation, @"bundleID");
    SEL pidSelector = NSSelectorFromString(@"processID");
    if (!process || ![bundle isKindOfClass:NSString.class] ||
        !TeleportIdleHasEncoding(process, pidSelector, "i16@0:8")) {
      @synchronized(state) { state.process = nil; state.bundle = nil; state.pid = 0; }
      TeleportIdleEmit(@{@"event": @"remember_error", @"reason": @"cached process identity unavailable"});
      return;
    }
    int pid = ((int (*)(id, SEL))objc_msgSend)(process, pidSelector);
    @synchronized(state) { state.process = process; state.bundle = bundle; state.pid = pid; }
    TeleportIdleEmit(@{@"event": @"remember", @"pid": @(pid), @"bundle": bundle,
                       @"processClass": NSStringFromClass(process.class)});
  } @catch (NSException *exception) {
    @synchronized(state) { state.process = nil; state.bundle = nil; state.pid = 0; }
    TeleportIdleEmit(@{@"event": @"remember_error", @"reason": exception.name});
  }
}

static void TeleportIdleTerminal(NSNumber *generation, NSString *kind) {
  TeleportIdleObservation *state = TeleportIdleState();
  @synchronized(state) {
    NSMutableDictionary *pending = state.pending[generation];
    [pending[@"remaining"] removeObject:kind];
    if (pending && [pending[@"remaining"] count] == 0) [state.pending removeObjectForKey:generation];
  }
}

static void TeleportIdleCallback(NSNumber *generation, NSString *kind, NSError *error) {
  @try {
    TeleportIdleObservation *state = TeleportIdleState();
    @synchronized(state) {
      NSMutableDictionary *pending = state.pending[generation];
      if (!pending || ![pending[@"remaining"] containsObject:kind]) {
        TeleportIdleEmit(@{@"event": @"duplicate_or_late_callback", @"generation": generation, @"kind": kind});
        return;
      }
      BOOL validError = !error || [error isKindOfClass:NSError.class];
      TeleportIdleEmit(@{@"event": @"callback", @"generation": generation, @"kind": kind,
                         @"pid": pending[@"pid"], @"bundle": pending[@"bundle"],
                         @"errorIsNil": @((BOOL)(error == nil)), @"validErrorType": @(validError),
                         @"errorDomain": validError && error ? error.domain : @"",
                         @"errorCode": validError && error ? @(error.code) : @0});
      TeleportIdleTerminal(generation, kind);
    }
  } @catch (NSException *exception) {
    TeleportIdleEmit(@{@"event": @"callback_exception", @"generation": generation,
                       @"kind": kind, @"reason": exception.name});
    TeleportIdleTerminal(generation, kind);
  }
}

void TeleportIdleObserveInput(NSString *route) {
  TeleportIdleObservation *state = TeleportIdleState();
  NSNumber *generation;
  NSObject *process;
  @synchronized(state) {
    generation = @(++state.generation);
    process = state.process;
    TeleportIdleEmit(@{@"event": @"input_complete", @"generation": generation, @"route": route,
                       @"pid": @(state.pid), @"bundle": state.bundle ?: @""});
    // At most four outstanding pairs, including missing/late replies. No timer,
    // sleeping, replay, app launch or wait for a reply is introduced. Native
    // registration itself can take time; begin/return records measure that cost.
    if (!process || state.pid <= 0 || state.pending.count >= 4) {
      TeleportIdleEmit(@{@"event": @"registration_error", @"generation": generation,
                         @"reason": !process || state.pid <= 0 ? @"no cached application" : @"outstanding callback bound"});
      return;
    }
    state.pending[generation] = [@{@"pid": @(state.pid), @"bundle": state.bundle,
                                  @"remaining": [NSMutableSet setWithArray:@[@"eventLoop", @"animations"]]} mutableCopy];
  }
  for (NSString *kind in @[@"eventLoop", @"animations"]) {
    @try {
      NSString *name = [kind isEqualToString:@"animations"] ? @"_notifyWhenAnimationsAreIdle:" : @"_notifyWhenMainRunLoopIsIdle:";
      SEL selector = NSSelectorFromString(name);
      if (!TeleportIdleHasEncoding(process, selector, "v24@0:8@?16")) {
        TeleportIdleEmit(@{@"event": @"registration_error", @"generation": generation,
                           @"kind": kind, @"reason": @"unsupported notification encoding"});
        TeleportIdleTerminal(generation, kind);
        continue;
      }
      NSString *frameworkUUID = TeleportIdleFrameworkUUID(process, selector);
      if (![frameworkUUID isEqualToString:@"12D8D288-FE92-327C-A8C9-9B18A863711B"]) {
        TeleportIdleEmit(@{@"event": @"registration_error", @"generation": generation,
                           @"kind": kind, @"reason": @"unsupported XCTest image", @"frameworkUUID": frameworkUUID});
        TeleportIdleTerminal(generation, kind);
        continue;
      }
      TeleportIdleEmit(@{@"event": @"registration_begin", @"generation": generation, @"kind": kind,
                         @"frameworkUUID": frameworkUUID});
      TeleportIdleReply callback = ^(NSError *error) { TeleportIdleCallback(generation, kind, error); };
      ((void (*)(id, SEL, TeleportIdleReply))objc_msgSend)(process, selector, callback);
      TeleportIdleEmit(@{@"event": @"registration_return", @"generation": generation, @"kind": kind,
                         @"frameworkUUID": frameworkUUID});
    } @catch (NSException *exception) {
      TeleportIdleEmit(@{@"event": @"registration_error", @"generation": generation,
                         @"kind": kind, @"reason": exception.name});
      TeleportIdleTerminal(generation, kind);
    }
  }
}
#endif
