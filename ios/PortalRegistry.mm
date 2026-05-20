//
//  PortalRegistry.m
//  Pods
//
//  Created by Kiryl Ziusko on 04/09/2025.
//

#import "PortalRegistry.h"
#import "MirrorView.h"
#import "PortalHostView.h"
#import "PortalView.h"

@interface PortalRegistry ()

@property (nonatomic, strong) NSMapTable<NSString *, PortalHostView *> *hosts;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSPointerArray *> *pendingPortals;
@property (nonatomic, strong) NSMapTable<NSString *, UIView *> *portalSources;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSPointerArray *> *pendingMirrors;

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
    _portalSources = [NSMapTable strongToWeakObjectsMapTable];
    _pendingMirrors = [NSMutableDictionary dictionary];
  }
  return self;
}

- (void)registerHost:(PortalHostView *)host withName:(NSString *)name
{
  if (name) {
    [self.hosts setObject:host forKey:name];
    [self notifySubscribersForName:name];
  }
}

- (void)unregisterHostWithName:(NSString *)name viewTag:(NSInteger)viewTag
{
  if (name) {
    PortalHostView *registered = [self.hosts objectForKey:name];
    if (registered && registered.tag == viewTag) {
      [self.hosts removeObjectForKey:name];
      [self notifySubscribersForName:name];
    }
  }
}

- (void)notifyMirrorsForName:(NSString *)name
{
  NSPointerArray *mirrors = self.pendingMirrors[name];
  if (!mirrors) {
    return;
  }

  [mirrors compact];

  for (NSUInteger i = 0; i < mirrors.count; i++) {
    MirrorView *mirror = (__bridge MirrorView *)[mirrors pointerAtIndex:i];
    if (mirror) {
      [mirror onSourceChanged];
    }
  }
}

- (void)notifySubscribersForName:(NSString *)name
{
  NSPointerArray *portals = self.pendingPortals[name];
  if (!portals) {
    return;
  }

  [portals compact];

  for (NSUInteger i = 0; i < portals.count; i++) {
    PortalView *portal = (__bridge PortalView *)[portals pointerAtIndex:i];
    if (portal) {
      [portal onHostChanged];
    }
  }
}

- (nullable PortalHostView *)getHostWithName:(NSString *)name
{
  if (!name)
    return nil;
  return [self.hosts objectForKey:name];
}

- (void)registerPortalSource:(UIView *)source withName:(NSString *)name
{
  if (name && source) {
    [self.portalSources setObject:source forKey:name];
    [self notifyMirrorsForPortalSourceName:name];
  }
}

- (void)unregisterPortalSourceWithName:(NSString *)name viewTag:(NSInteger)viewTag
{
  if (name) {
    UIView *registered = [self.portalSources objectForKey:name];
    if (registered && registered.tag == viewTag) {
      [self.portalSources removeObjectForKey:name];
      [self notifyMirrorsForName:name];
    }
  }
}

- (void)unregisterPortalSourceWithName:(NSString *)name source:(UIView *)source
{
  if (name && source) {
    UIView *registered = [self.portalSources objectForKey:name];
    if (registered == source) {
      [self.portalSources removeObjectForKey:name];
      [self notifyMirrorsForName:name];
    }
  }
}

- (nullable UIView *)getPortalSourceWithName:(NSString *)name
{
  if (!name)
    return nil;
  return [self.portalSources objectForKey:name];
}

- (void)notifyMirrorsForPortalSourceName:(NSString *)name
{
  if (!name) {
    return;
  }

  NSString *nameCopy = [name copy];
  dispatch_async(dispatch_get_main_queue(), ^{
    [self notifyMirrorsForName:nameCopy];
  });
}

- (void)notifyHostLayoutChangedWithName:(NSString *)name
{
  if (!name) {
    return;
  }

  NSPointerArray *portals = self.pendingPortals[name];
  if (!portals) {
    return;
  }

  [portals compact];

  for (NSUInteger i = 0; i < portals.count; i++) {
    PortalView *portal = (__bridge PortalView *)[portals pointerAtIndex:i];
    if (portal) {
      [portal onHostLayoutChanged];
    }
  }
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

- (void)registerPendingMirror:(MirrorView *)mirror withName:(NSString *)name
{
  if (!name || !mirror) {
    return;
  }

  NSPointerArray *mirrors = self.pendingMirrors[name];
  if (!mirrors) {
    mirrors = [NSPointerArray weakObjectsPointerArray];
    self.pendingMirrors[name] = mirrors;
  }

  [mirrors addPointer:(__bridge void *)mirror];
}

- (void)unregisterPendingMirror:(MirrorView *)mirror withName:(NSString *)name
{
  if (!name || !mirror) {
    return;
  }

  NSPointerArray *mirrors = self.pendingMirrors[name];
  if (!mirrors) {
    return;
  }

  for (NSUInteger i = 0; i < mirrors.count; i++) {
    MirrorView *existingMirror = (__bridge MirrorView *)[mirrors pointerAtIndex:i];
    if (existingMirror == mirror) {
      [mirrors removePointerAtIndex:i];
      break;
    }
  }

  [mirrors compact];
  if (mirrors.count == 0) {
    [self.pendingMirrors removeObjectForKey:name];
  }
}

@end
