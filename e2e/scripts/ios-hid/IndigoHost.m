// Experimental, simulator-only persistent input transport. No default device
// selection, app launch, gesture replay, or delivery-error fallback.
#import "Indigo.h"
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <malloc/malloc.h>
#import <math.h>
#import <objc/runtime.h>

@protocol HIDClient
- (id)initWithDevice:(id)device error:(NSError **)error;
- (void)sendWithMessage:(void *)message
           freeWhenDone:(BOOL)freeWhenDone
        completionQueue:(dispatch_queue_t)queue
             completion:(void (^)(NSError *))completion;
@end

@protocol ServiceContext
+ (id)sharedServiceContextForDeveloperDir:(NSString *)directory
                                    error:(NSError **)error;
- (id)defaultDeviceSetWithError:(NSError **)error;
@end

typedef IndigoMessage *(*MouseBuilder)(CGPoint *, CGPoint *, uint32_t,
                                       NSUInteger, CGSize, uint32_t);

static void require(BOOL value, NSString *message) {
  if (!value)
    @throw [NSException exceptionWithName:@"IndigoTransportError"
                                   reason:message
                                 userInfo:nil];
}

static void emit(NSDictionary *value) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value
                                                 options:NSJSONWritingSortedKeys
                                                   error:NULL];
  fwrite(data.bytes, 1, data.length, stdout);
  fputc('\n', stdout);
  fflush(stdout);
}

static double number(NSDictionary *value, NSString *key) {
  id raw = value[key];
  require([raw isKindOfClass:NSNumber.class] &&
              CFGetTypeID((__bridge CFTypeRef)raw) != CFBooleanGetTypeID(),
          [@"Missing numeric field " stringByAppendingString:key]);
  double result = [raw doubleValue];
  require(isfinite(result), @"Non-finite gesture value");
  return result;
}

@interface IndigoTransport : NSObject
@property(nonatomic, strong) id<HIDClient> client;
@property(nonatomic) MouseBuilder builder;
@property(nonatomic) CGSize pixels;
@property(nonatomic) double scale;
@property(nonatomic, strong) dispatch_queue_t queue;
@property(nonatomic) NSUInteger actions;
- (NSDictionary *)perform:(NSDictionary *)request;
@end

@implementation IndigoTransport
- (NSDictionary *)perform:(NSDictionary *)request {
  NSArray *frames = request[@"frames"];
  require([frames isKindOfClass:NSArray.class] && frames.count >= 2 &&
              frames.count <= 1000,
          @"Expected a bounded single-contact frame list");
  double last = -1;
  for (NSUInteger i = 0; i < frames.count; i++) {
    require([frames[i] isKindOfClass:NSDictionary.class], @"Invalid frame");
    NSDictionary *frame = frames[i];
    double offset = number(frame, @"offset");
    double x = number(frame, @"x"), y = number(frame, @"y");
    require(offset >= 0 && offset >= last && offset <= 60,
            @"Invalid frame timeline");
    require(x >= 0 && y >= 0 && x <= self.pixels.width / self.scale &&
                y <= self.pixels.height / self.scale,
            @"Touch outside the selected display");
    require([frame[@"phase"] isEqual:(i == frames.count - 1 ? @"up" : @"down")],
            @"Expected DOWN/position frames followed by exactly one UP");
    if (i == 0)
      require(offset == 0, @"First contact must start at offset zero");
    last = offset;
  }
  dispatch_group_t pending = dispatch_group_create();
  __block NSError *deliveryFailure = nil;
  NSMutableArray *actual = [NSMutableArray array];
  const double start = NSProcessInfo.processInfo.systemUptime;
  for (NSDictionary *frame in frames) {
    double remaining = start + [frame[@"offset"] doubleValue] -
                       NSProcessInfo.processInfo.systemUptime;
    if (remaining > 0)
      [NSThread sleepForTimeInterval:remaining];
    __block NSException *sendFailure = nil;
    dispatch_sync(self.queue, ^{
      @try {
        CGPoint point = CGPointMake(
            [frame[@"x"] doubleValue] * self.scale / self.pixels.width,
            [frame[@"y"] doubleValue] * self.scale / self.pixels.height);
        BOOL up = [frame[@"phase"] isEqual:@"up"];
        // idb represents positions as subsequent DOWN events on the same
        // contact. Keep the native 0xa0-stride packet; Xcode16.4's isolated
        // probe confirmed eventType2, 352 bytes and native DOWN/UP phase fields
        // for this builder.
        IndigoMessage *message =
            self.builder(&point, NULL, 0x32, up ? 2 : 1, CGSizeMake(1, 1), 0);
        require(message != NULL, @"Native builder returned no packet");
        size_t length = malloc_size(message);
        // malloc_size includes allocator padding (the local fake is rounded to
        // 384); the native single-touch wire layout is 0x20 + 2 * 0xa0 bytes.
        BOOL valid = length >= 352 && message->innerSize == 160 &&
                     message->eventType == 2 &&
                     message->payload.event.touch.field9 == (up ? 0u : 1u) &&
                     message->payload.event.touch.field10 == (up ? 0u : 1u) &&
                     message->payload.event.touch.xRatio == point.x &&
                     message->payload.event.touch.yRatio == point.y;
        if (!valid)
          free(message);
        require(valid,
                [NSString
                    stringWithFormat:@"Native packet differs from the verified "
                                     @"Xcode16.4 contract (allocation=%zu)",
                                     length]);
        dispatch_group_enter(pending);
        @try {
          [self.client sendWithMessage:message
                          freeWhenDone:YES
                       completionQueue:self.queue
                            completion:^(NSError *error) {
                              if (error && !deliveryFailure)
                                deliveryFailure = error;
                              dispatch_group_leave(pending);
                            }];
        } @catch (NSException *exception) {
          // Ownership may already have transferred. Do not risk a double free.
          dispatch_group_leave(pending);
          @throw exception;
        }
        [actual addObject:@{
          @"phase" : frame[@"phase"],
          @"requested" : frame[@"offset"],
          @"sent" : @(NSProcessInfo.processInfo.systemUptime - start),
          @"xRatio" : @(point.x),
          @"yRatio" : @(point.y)
        }];
      } @catch (NSException *exception) {
        sendFailure = exception;
      }
    });
    if (sendFailure)
      @throw sendFailure;
  }
  // Never wait for DOWN acknowledgement while holding the contact: queue the
  // original UP on its timeline, then drain all delivery acknowledgements.
  require(dispatch_group_wait(pending, dispatch_time(DISPATCH_TIME_NOW,
                                                     60 * NSEC_PER_SEC)) == 0,
          @"HID delivery acknowledgement timed out");
  require(
      deliveryFailure == nil,
      [NSString stringWithFormat:@"HID delivery failed: %@", deliveryFailure]);
  self.actions++;
  return @{
    @"type" : @"delivered",
    @"id" : request[@"id"],
    @"action" : @(self.actions),
    @"frames" : actual,
    @"acknowledged" : @(frames.count),
    @"elapsed" : @(NSProcessInfo.processInfo.systemUptime - start)
  };
}
@end

// A native fake exercises the actual transport scheduling and ownership path,
// without loading Apple private frameworks or constructing a device/client.
@interface FakeHIDClient : NSObject <HIDClient>
@property(nonatomic) BOOL fail;
@property(nonatomic, strong) NSMutableArray *downAcknowledgements;
@end
@implementation FakeHIDClient
- (id)initWithDevice:(id)device error:(NSError **)error {
  (void)device;
  (void)error;
  return [self init];
}
- (void)sendWithMessage:(void *)raw
           freeWhenDone:(BOOL)freeWhenDone
        completionQueue:(dispatch_queue_t)queue
             completion:(void (^)(NSError *))completion {
  const IndigoMessage *message = raw;
  BOOL down = message->payload.event.touch.field10 != 0;
  if (freeWhenDone)
    free(raw);
  if (down) {
    if (!self.downAcknowledgements)
      self.downAcknowledgements = [NSMutableArray array];
    [self.downAcknowledgements addObject:[completion copy]];
  } else {
    require(self.downAcknowledgements.count > 0,
            @"UP was delivered without a pending DOWN");
    NSArray *downCompletions = [self.downAcknowledgements copy];
    [self.downAcknowledgements removeAllObjects];
    dispatch_async(queue, ^{
      NSError *error = self.fail ? [NSError errorWithDomain:@"MockDelivery"
                                                       code:1
                                                   userInfo:nil]
                                 : nil;
      for (void (^downCompletion)(NSError *) in downCompletions)
        downCompletion(error);
      completion(error);
    });
  }
}
@end

static IndigoMessage *fakeBuilder(CGPoint *point, CGPoint *second,
                                  uint32_t target, NSUInteger type, CGSize size,
                                  uint32_t edge) {
  (void)second;
  (void)target;
  (void)size;
  (void)edge;
  IndigoMessage *message = calloc(1, 352);
  message->innerSize = 160;
  message->eventType = 2;
  message->payload.event.touch.xRatio = point->x;
  message->payload.event.touch.yRatio = point->y;
  message->payload.event.touch.field9 = type == 1;
  message->payload.event.touch.field10 = type == 1;
  return message;
}

static NSDictionary *selfTest(void) {
  IndigoTransport *transport = [IndigoTransport new];
  FakeHIDClient *client = [FakeHIDClient new];
  transport.client = client;
  transport.builder = fakeBuilder;
  transport.pixels = CGSizeMake(1206, 2622);
  transport.scale = 3;
  transport.queue =
      dispatch_queue_create("teleport.hid.fixture", DISPATCH_QUEUE_SERIAL);
  NSDictionary *request = @{
    @"id" : @1,
    @"frames" : @[
      @{@"phase" : @"down",
        @"offset" : @0,
        @"x" : @201,
        @"y" : @193},
      @{@"phase" : @"up",
        @"offset" : @0.1,
        @"x" : @201,
        @"y" : @193}
    ]
  };
  NSDictionary *result = [transport perform:request];
  require([result[@"acknowledged"] integerValue] == 2,
          @"Did not drain acknowledgements");
  // The fake cannot acknowledge DOWN until UP arrives. Completing the gesture
  // proves that sending UP did not wait for the earlier acknowledgement,
  // without a wall-clock threshold sensitive to host scheduling.
  NSMutableArray *swipe = [NSMutableArray array];
  for (NSUInteger i = 0; i <= 6; i++) {
    [swipe addObject:@{
      @"phase" : @"down",
      @"offset" : @(0.1 * i / 6),
      @"x" : @(201 + 160.0 * i / 6),
      @"y" : @591
    }];
  }
  [swipe addObject:@{
    @"phase" : @"up",
    @"offset" : @0.11,
    @"x" : @361,
    @"y" : @591
  }];
  NSDictionary *swipeResult = [transport perform:@{
    @"id" : @2,
    @"frames" : swipe
  }];
  require([swipeResult[@"acknowledged"] integerValue] == 8,
          @"Did not drain position acknowledgements");
  client.fail = YES;
  BOOL rejected = NO;
  @try {
    [transport perform:request];
  } @catch (NSException *e) {
    rejected = [e.reason containsString:@"HID delivery failed"];
  }
  require(rejected, @"Delivery error was swallowed");
  return @{
    @"type" : @"self-test",
    @"late_ack_does_not_extend_hold" : @YES,
    @"delivery_error_propagated" : @YES,
    @"validActions" : @2,
    @"contactFrames" : @10,
    @"deviceAPICalls" : @0,
    @"messagesSentToDevice" : @0
  };
}

static IndigoTransport *connect(NSString *udid, NSString *developer,
                                NSString *core, NSString *kit) {
  for (NSString *binary in @[ core, kit ]) {
    void *handle =
        dlopen(binary.fileSystemRepresentation, RTLD_NOW | RTLD_GLOBAL);
    require(handle != NULL, [NSString stringWithFormat:@"Cannot load %@: %s",
                                                       binary, dlerror()]);
  }
  Class contextClass = NSClassFromString(@"SimServiceContext");
  Class clientClass =
      NSClassFromString(@"SimulatorKit.SimDeviceLegacyHIDClient");
  require(clientClass != Nil && contextClass != Nil,
          @"Verified HID runtime unavailable");
  require(
      [[[NSBundle bundleForClass:contextClass]
          infoDictionary][@"CFBundleVersion"] isEqual:@"1051.17.8"] &&
          [[[[NSBundle bundleForClass:clientClass]
              infoDictionary][@"CFBundleVersion"] description] isEqual:@"944"],
      @"Unsupported CoreSimulator/SimulatorKit version");
  NSError *error = nil;
  id context = [(id<ServiceContext>)contextClass
      sharedServiceContextForDeveloperDir:developer
                                    error:&error];
  require(
      context != nil,
      [NSString stringWithFormat:@"Cannot resolve service context: %@", error]);
  id set = [(id<ServiceContext>)context defaultDeviceSetWithError:&error];
  require(set != nil,
          [NSString stringWithFormat:@"Cannot resolve default device set: %@",
                                     error]);
  NSUUID *identifier = [[NSUUID alloc] initWithUUIDString:udid];
  require(identifier != nil, @"Expected an explicit Simulator UDID");
  id device = [[set valueForKey:@"devicesByUDID"] objectForKey:identifier];
  require(device != nil && [[device valueForKey:@"UDID"] isEqual:identifier],
          @"Selected Simulator unavailable");
  require([[device valueForKey:@"stateString"] isEqual:@"Booted"],
          @"Selected Simulator is not booted");
  id deviceType = [device valueForKey:@"deviceType"];
  NSValue *size = [deviceType valueForKey:@"mainScreenSize"];
  NSSize pixels = size.sizeValue;
  double scale = [[deviceType valueForKey:@"mainScreenScale"] doubleValue];
  require(pixels.width > 0 && pixels.height > 0 && scale > 0,
          @"Invalid display geometry");
  id<HIDClient> client =
      [(id<HIDClient>)[clientClass alloc] initWithDevice:device error:&error];
  require(client != nil,
          [NSString stringWithFormat:@"Cannot connect selected HID client: %@",
                                     error]);
  IndigoTransport *transport = [IndigoTransport new];
  transport.client = client;
  transport.builder =
      (MouseBuilder)dlsym(RTLD_DEFAULT, "IndigoHIDMessageForMouseNSEvent");
  require(transport.builder != NULL, @"Verified native builder unavailable");
  transport.pixels = pixels;
  transport.scale = scale;
  transport.queue =
      dispatch_queue_create("teleport.hid.send", DISPATCH_QUEUE_SERIAL);
  emit(@{
    @"type" : @"ready",
    @"deviceUDID" : identifier.UUIDString,
    @"clientClass" : NSStringFromClass(clientClass),
    @"clientInstances" : @1,
    @"pixels" : @[ @(pixels.width), @(pixels.height) ],
    @"scale" : @(scale)
  });
  return transport;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    @try {
      if (argc == 2 && strcmp(argv[1], "--self-test") == 0) {
        emit(selfTest());
        return 0;
      }
      require(argc == 5,
              @"Usage: IndigoHost UDID DEVELOPER_DIR CORE_BINARY KIT_BINARY");
      NSString *udid = @(argv[1]);
      IndigoTransport *transport =
          connect(udid, @(argv[2]), @(argv[3]), @(argv[4]));
      // Keep the framework's main dispatch queue available while the command
      // reader and scheduled gesture producer wait on input/acknowledgements.
      dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        @autoreleasepool {
          @try {
            char *line = NULL;
            size_t capacity = 0;
            ssize_t length;
            while ((length = getline(&line, &capacity, stdin)) != -1) {
              @autoreleasepool {
                require(length <= 1024 * 1024, @"Oversized gesture input");
                NSData *data = [NSData dataWithBytes:line
                                              length:(NSUInteger)length];
                NSDictionary *request =
                    [NSJSONSerialization JSONObjectWithData:data
                                                    options:0
                                                      error:NULL];
                require([request isKindOfClass:NSDictionary.class] &&
                            request[@"id"] != nil,
                        @"Invalid gesture request");
                require([request[@"deviceUDID"] isKindOfClass:NSString.class] &&
                            [request[@"deviceUDID"]
                                caseInsensitiveCompare:udid] == NSOrderedSame,
                        @"Gesture addressed to another Simulator");
                emit([transport perform:request]);
              }
            }
            free(line);
            exit(0);
          } @catch (NSException *exception) {
            emit(@{
              @"type" : @"fatal",
              @"error" : exception.reason ?: exception.name
            });
            exit(1);
          }
        }
      });
      dispatch_main();
    } @catch (NSException *exception) {
      emit(
          @{@"type" : @"fatal", @"error" : exception.reason ?: exception.name});
      return 1;
    }
  }
}
