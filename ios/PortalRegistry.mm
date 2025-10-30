//
//  PortalRegistry.m
//  Pods
//
//  Created by Kiryl Ziusko on 04/09/2025.
//

#import "PortalRegistry.h"
#import "PortalHostView.h"
#import "PortalView.h"

@interface PortalRegistry ()

@property (nonatomic, strong) NSMapTable<NSString *, PortalHostView *> *hosts;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSPointerArray *> *pendingPortals;

@end

@implementation PortalRegistry

+ (instancetype)sharedInstance
{
  static PortalRegistry *sharedInstance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[self alloc] init];
  });
  return sharedInstance;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _hosts = [NSMapTable strongToWeakObjectsMapTable];
    _pendingPortals = [NSMutableDictionary dictionary];
  }
  return self;
}

- (void)registerHost:(PortalHostView *)host withName:(NSString *)name
{
  if (name) {
    [self.hosts setObject:host forKey:name];

    // Notify all pending portals that their host is now available
    NSPointerArray *portals = self.pendingPortals[name];
    if (portals) {
      // Compact the array to remove nil entries
      [portals compact];

      for (NSUInteger i = 0; i < portals.count; i++) {
        PortalView *portal = (__bridge PortalView *)[portals pointerAtIndex:i];
        if (portal) {
          [portal onHostAvailable];
        }
      }

      [self.pendingPortals removeObjectForKey:name];
    }
  }
}

- (void)unregisterHostWithName:(NSString *)name
{
  if (name) {
    [self.hosts removeObjectForKey:name];
  }
}

- (nullable PortalHostView *)getHostWithName:(NSString *)name
{
  if (!name)
    return nil;
  return [self.hosts objectForKey:name];
}

- (void)registerPendingPortal:(PortalView *)portal withHostName:(NSString *)hostName
{
  if (!hostName || !portal) {
    return;
  }

  NSPointerArray *portals = self.pendingPortals[hostName];
  if (!portals) {
    portals = [NSPointerArray weakObjectsPointerArray];
    self.pendingPortals[hostName] = portals;
  }

  [portals addPointer:(__bridge void *)portal];
}

- (void)unregisterPendingPortal:(PortalView *)portal withHostName:(NSString *)hostName
{
  if (!hostName || !portal) {
    return;
  }

  NSPointerArray *portals = self.pendingPortals[hostName];
  if (!portals) {
    return;
  }

  // Remove the portal from the array
  for (NSUInteger i = 0; i < portals.count; i++) {
    PortalView *existingPortal = (__bridge PortalView *)[portals pointerAtIndex:i];
    if (existingPortal == portal) {
      [portals removePointerAtIndex:i];
      break;
    }
  }

  // Clean up if no more portals
  [portals compact];
  if (portals.count == 0) {
    [self.pendingPortals removeObjectForKey:hostName];
  }
}

@end
