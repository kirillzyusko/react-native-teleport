//
//  PortalRegistry.m
//  Pods
//
//  Created by Kiryl Ziusko on 04/09/2025.
//

#import "PortalRegistry.h"
#import "PortalHostView.h"

@interface PortalRegistry ()

@property (nonatomic, strong) NSMapTable<NSString *, PortalHostView *> *hosts;

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
  }
  return self;
}

- (void)registerHost:(PortalHostView *)host withName:(NSString *)name
{
  if (name) {
    [self.hosts setObject:host forKey:name];
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

@end
