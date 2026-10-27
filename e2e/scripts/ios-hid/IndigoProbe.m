// This program constructs packets in host memory. It never resolves a device,
// creates a HID client, sends a message, or changes simulator state.
#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <objc/runtime.h>
#import <dlfcn.h>
#import <mach/mach_time.h>
#import <malloc/malloc.h>
#import <math.h>
#import "Indigo.h"

_Static_assert(sizeof(IndigoTouch) == 0x70, "Unexpected touch layout");
_Static_assert(sizeof(IndigoPayload) == 0x90, "Unexpected payload layout");
_Static_assert(sizeof(IndigoMessage) == 0xb0, "Unexpected message layout");
_Static_assert(offsetof(IndigoMessage, payload) == 0x20, "Unexpected payload offset");
_Static_assert(offsetof(IndigoMessage, payload.event.touch) == 0x30, "Unexpected touch offset");
_Static_assert(offsetof(IndigoTouch, xRatio) == 0xc, "Unexpected coordinate offset");

// Current idb declaration. The actual toolchain's disassembly and non-unit-size
// packet results are archived to verify it, rather than assuming the SDK ABI.
typedef IndigoMessage *(*MouseBuilder)(CGPoint *, CGPoint *, uint32_t,
                                      NSUInteger, CGSize, uint32_t);

static void require(BOOL condition, NSString *message) {
  if (!condition) @throw [NSException exceptionWithName:@"ContractError"
                                                reason:message userInfo:nil];
}

// Derived from facebook/idb FBSimulatorIndigoHID.m at
// 8b8294d4f232777ed2b6747516e2360f73475553; see IDB-LICENSE.
static NSData *envelope(const IndigoTouch *touch) {
  const size_t stride = sizeof(IndigoPayload);
  const size_t size = sizeof(IndigoMessage) + stride;
  IndigoMessage *message = calloc(1, size);
  require(message != NULL, @"Packet allocation failed");
  message->innerSize = (uint32_t)stride;
  message->eventType = IndigoEventTypeTouch;
  message->payload.field1 = 0xb;
  message->payload.timestamp = mach_absolute_time();
  memcpy(&message->payload.event.touch, touch, sizeof(*touch));
  IndigoPayload *second = (void *)((char *)&message->payload + stride);
  memcpy(second, &message->payload, stride);
  second->event.touch.field1 = 1;
  second->event.touch.field2 = 2;
  return [NSData dataWithBytesNoCopy:message length:size freeWhenDone:YES];
}

static NSDictionary *touchFields(const IndigoTouch *touch) {
  require(isfinite(touch->xRatio) && isfinite(touch->yRatio), @"Non-finite packet coordinate");
  return @{@"field1": @(touch->field1), @"field2": @(touch->field2),
           @"mask": @(touch->field3), @"xRatio": @(touch->xRatio),
           @"yRatio": @(touch->yRatio), @"range": @(touch->field9),
           @"touch": @(touch->field10)};
}

static NSDictionary *fixtures(void) {
  NSUInteger count = 0;
  for (NSUInteger i = 0; i < 257; i++) {
    IndigoTouch touch;
    memset(&touch, 0x5a, sizeof(touch));
    touch.xRatio = (double)i / 256;
    touch.yRatio = 1 - touch.xRatio;
    NSData *data = envelope(&touch);
    const IndigoMessage *message = data.bytes;
    const IndigoPayload *second = (const void *)((const char *)&message->payload + 0x90);
    require(data.length == 0x140 && message->innerSize == 0x90 &&
            message->eventType == 2 && message->payload.field1 == 0xb,
            @"Incorrect single-touch envelope");
    require(memcmp(&message->payload.event.touch, &touch, sizeof(touch)) == 0,
            @"Envelope changed the source touch");
    IndigoPayload expected = message->payload;
    expected.event.touch.field1 = 1;
    expected.event.touch.field2 = 2;
    require(memcmp(second, &expected, sizeof(expected)) == 0,
            @"Duplicated contact mismatch");
    count++;
  }
  return @{@"cases": @(count), @"packetSize": @0x140, @"payloadStride": @0x90,
           @"deviceAPICalls": @0, @"clientInstances": @0, @"messagesSent": @0};
}

static NSDictionary *methodInfo(Class cls, NSString *name, BOOL classMethod) {
  SEL selector = NSSelectorFromString(name);
  Method method = classMethod ? class_getClassMethod(cls, selector) : class_getInstanceMethod(cls, selector);
  require(method != NULL, [NSString stringWithFormat:@"Missing %@ %@", NSStringFromClass(cls), name]);
  return @{@"class": NSStringFromClass(cls), @"selector": name,
           @"classMethod": @(classMethod),
           @"encoding": @(method_getTypeEncoding(method)),
           @"arguments": @(method_getNumberOfArguments(method))};
}

static NSDictionary *inspect(NSString *developer, NSString *output) {
  NSString *corePath = @"/Library/Developer/PrivateFrameworks/CoreSimulator.framework/CoreSimulator";
  NSString *kitPath = [[developer stringByDeletingLastPathComponent]
      stringByAppendingPathComponent:@"SharedFrameworks/SimulatorKit.framework/SimulatorKit"];
  for (NSString *path in @[corePath, kitPath]) {
    void *handle = dlopen(path.fileSystemRepresentation, RTLD_NOW | RTLD_GLOBAL);
    require(handle != NULL, [NSString stringWithFormat:@"Cannot load %@: %s", path, dlerror()]);
  }
  Class client = NSClassFromString(@"SimulatorKit.SimDeviceLegacyHIDClient");
  Class context = NSClassFromString(@"SimServiceContext");
  Class deviceSet = NSClassFromString(@"SimDeviceSet");
  Class device = NSClassFromString(@"SimDevice");
  require(client && context && deviceSet && device, @"Missing Simulator runtime classes");
  NSArray *methods = @[
    methodInfo(client, @"initWithDevice:error:", NO),
    methodInfo(client, @"sendWithMessage:freeWhenDone:completionQueue:completion:", NO),
    methodInfo(context, @"sharedServiceContextForDeveloperDir:error:", YES),
    methodInfo(context, @"defaultDeviceSetWithError:", NO),
    methodInfo(deviceSet, @"devicesByUDID", NO),
    methodInfo(device, @"UDID", NO), methodInfo(device, @"state", NO),
    methodInfo(device, @"deviceType", NO)
  ];
  MouseBuilder builder = (MouseBuilder)dlsym(RTLD_DEFAULT, "IndigoHIDMessageForMouseNSEvent");
  require(builder != NULL, @"Mouse builder symbol missing");
  NSMutableArray *packets = [NSMutableArray array];
  // A non-unit size reveals whether the native function consumes the CGSize
  // arguments; unit inputs alone would conceal a wrong declaration.
  for (NSNumber *unit in @[@YES, @NO]) {
    for (NSNumber *direction in @[@1, @2]) {
      CGPoint point = CGPointMake(0.25, 0.75);
      CGSize size = unit.boolValue ? CGSizeMake(1, 1) : CGSizeMake(2, 4);
      IndigoMessage *native = builder(&point, NULL, 0x32, direction.unsignedIntegerValue, size, 0);
      require(native != NULL, @"Native builder returned NULL");
      size_t length = malloc_size(native);
      require(length >= sizeof(IndigoMessage) && length <= 4096,
              @"Unexpected native packet allocation");
      NSDictionary *fields = touchFields(&native->payload.event.touch);
      NSData *raw = [NSData dataWithBytes:native length:length];
      // idb sets the ratios explicitly before creating the single-touch packet.
      native->payload.event.touch.xRatio = point.x;
      native->payload.event.touch.yRatio = point.y;
      NSData *single = envelope(&native->payload.event.touch);
      NSString *stem = [NSString stringWithFormat:@"%@-%@", unit.boolValue ? @"unit" : @"nonunit", direction];
      require([raw writeToFile:[output stringByAppendingPathComponent:[stem stringByAppendingString:@"-native.bin"]] atomically:YES], @"Cannot save native packet");
      require([single writeToFile:[output stringByAppendingPathComponent:[stem stringByAppendingString:@"-single.bin"]] atomically:YES], @"Cannot save single packet");
      [packets addObject:@{@"name": stem, @"nativeLength": @(length),
          @"innerSize": @(native->innerSize), @"eventType": @(native->eventType),
          @"nativeTouch": fields, @"singleLength": @(single.length),
          @"pointAfterCall": @[@(point.x), @(point.y)]}];
      free(native);
    }
  }
  return @{@"methods": methods, @"packets": packets, @"deviceAPICalls": @0,
           @"clientInstances": @0, @"messagesSent": @0};
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    @try {
      NSDictionary *result;
      if (argc == 2 && strcmp(argv[1], "--fixtures") == 0) {
        result = fixtures();
      } else if (argc == 4 && strcmp(argv[1], "--inspect") == 0) {
        result = inspect(@(argv[2]), @(argv[3]));
      } else {
        fprintf(stderr, "Usage: IndigoProbe --fixtures | --inspect DEVELOPER_DIR OUTPUT\n");
        return 2;
      }
      NSData *json = [NSJSONSerialization dataWithJSONObject:result
          options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys error:nil];
      fwrite(json.bytes, 1, json.length, stdout);
      fputc('\n', stdout);
      return 0;
    } @catch (NSException *error) {
      fprintf(stderr, "%s: %s\n", error.name.UTF8String, error.reason.UTF8String);
      return 1;
    }
  }
}
