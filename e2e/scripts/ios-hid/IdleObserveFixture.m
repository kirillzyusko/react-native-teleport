// Device-free exercise of the actual production observer, included by its test.
#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <mach-o/loader.h>
#undef TARGET_OS_SIMULATOR
#define TARGET_OS_SIMULATOR 1

typedef void (^FixtureIdleReply)(NSError *error);
static NSMutableArray<FixtureIdleReply> *deferred;
static NSString *fixtureMode;
static int extraAPICalls;

@interface FixtureIdleProcess : NSObject
@property(nonatomic) int processID;
@end
@implementation FixtureIdleProcess
- (void)notify:(FixtureIdleReply)reply {
  if ([fixtureMode isEqualToString:@"throw"]) {
    @throw [NSException exceptionWithName:@"FixtureRegistrationException" reason:@"fixture" userInfo:nil];
  }
  if ([fixtureMode isEqualToString:@"deferred"] || [fixtureMode isEqualToString:@"bound"] || [fixtureMode isEqualToString:@"replaceProcess"]) {
    [deferred addObject:[reply copy]];
    return;
  }
  NSError *error = [fixtureMode isEqualToString:@"error"] ?
      [NSError errorWithDomain:@"FixtureIdle" code:17 userInfo:nil] : nil;
  reply(error);
  if ([fixtureMode isEqualToString:@"duplicate"]) reply(error);
}
- (void)_notifyWhenMainRunLoopIsIdle:(FixtureIdleReply)reply { [self notify:reply]; }
- (void)_notifyWhenAnimationsAreIdle:(FixtureIdleReply)reply { [self notify:reply]; }
- (BOOL)running { extraAPICalls++; return YES; }
@end

@interface FixtureWrongProcess : NSObject
@property(nonatomic) int processID;
@end
@implementation FixtureWrongProcess
- (int)_notifyWhenMainRunLoopIsIdle:(id)reply { (void)reply; abort(); }
- (int)_notifyWhenAnimationsAreIdle:(id)reply { (void)reply; abort(); }
@end

@interface FixtureApplicationImpl : NSObject
@property(nonatomic, strong) NSObject *currentProcess;
@property(nonatomic, copy) NSString *bundleID;
@end
@implementation FixtureApplicationImpl
@end

@interface FixtureApplication : NSObject
@property(nonatomic, strong) FixtureApplicationImpl *applicationImpl;
@end
@implementation FixtureApplication
+ (NSArray *)activeAppsInfo { extraAPICalls++; return @[]; }
- (NSUInteger)state { extraAPICalls++; return 4; }
- (void)launch { extraAPICalls++; }
@end

static int FixtureIdleDladdr(const void *address, Dl_info *image) {
  (void)address;
  static struct { struct mach_header_64 header; struct uuid_command command; } binary;
  binary.header.magic = MH_MAGIC_64;
  binary.header.cputype = CPU_TYPE_ARM64;
  binary.header.ncmds = 1;
  binary.header.sizeofcmds = sizeof(binary.command);
  binary.command.cmd = LC_UUID;
  binary.command.cmdsize = sizeof(binary.command);
  NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:@"12D8D288-FE92-327C-A8C9-9B18A863711B"];
  [uuid getUUIDBytes:binary.command.uuid];
  if ([fixtureMode isEqualToString:@"wrongImage"]) binary.command.uuid[0] ^= 1;
  image->dli_fbase = &binary;
  image->dli_fname = "fixture-XCUIAutomation";
  return 1;
}

// The test inserts the exact helper produced by native_helper() here.
#define dladdr FixtureIdleDladdr
__TELEPORT_IDLE_NATIVE_HELPER__
#undef dladdr

int main(int argc, const char **argv) {
  @autoreleasepool {
    if (argc != 2) return 2;
    fixtureMode = [NSString stringWithUTF8String:argv[1]];
    deferred = [NSMutableArray array];
    FixtureApplication *app = [FixtureApplication new];
    app.applicationImpl = [FixtureApplicationImpl new];
    app.applicationImpl.bundleID = @"teleport.example";
    if ([fixtureMode isEqualToString:@"wrongEncoding"]) {
      FixtureWrongProcess *process = [FixtureWrongProcess new];
      process.processID = 101;
      app.applicationImpl.currentProcess = process;
    } else if (![fixtureMode isEqualToString:@"missingProcess"]) {
      FixtureIdleProcess *process = [FixtureIdleProcess new];
      process.processID = 101;
      app.applicationImpl.currentProcess = process;
    }
    TeleportIdleRememberApplication(app);
    NSUInteger inputs = [fixtureMode isEqualToString:@"bound"] ? 6 : 1;
    for (NSUInteger i = 0; i < inputs; i++) TeleportIdleObserveInput(@"touch");
    if ([fixtureMode isEqualToString:@"replaceProcess"]) {
      FixtureIdleProcess *process = [FixtureIdleProcess new];
      process.processID = 202;
      app.applicationImpl.currentProcess = process;
      TeleportIdleRememberApplication(app);
      TeleportIdleObserveInput(@"swipeV2");
      inputs++;
      app = nil;
    }
    NSUInteger deferredBeforeDrain = deferred.count;
    NSArray<FixtureIdleReply> *replies = [deferred copy];
    [deferred removeAllObjects];
    for (FixtureIdleReply reply in replies) reply(nil);
    NSDictionary *result = @{@"mode": fixtureMode, @"inputs": @(inputs),
                             @"deferredBeforeDrain": @(deferredBeforeDrain),
                             @"extraAPIcalls": @(extraAPICalls),
                             @"pendingAfterDrain": @(TeleportIdleState().pending.count)};
    NSData *data = [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingSortedKeys error:NULL];
    puts([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
    return extraAPICalls ? 3 : 0;
  }
}
