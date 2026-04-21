//
//  PortalHostView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 02/09/2025.
//

#import "PortalHostView.h"
#import "PortalRegistry.h"

#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>
#import <react/renderer/components/TeleportViewSpec/RNTPortalHostViewComponentDescriptor.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface PortalHostView () <RCTPortalHostViewViewProtocol>

@property (nonatomic, strong) NSString *registeredName;
@property (nonatomic, assign) BOOL isInBatch;
@property (nonatomic, assign) NSInteger batchBaseIndex;

@end

@implementation PortalHostView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<PortalHostViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PortalHostViewProps>();
    _props = defaultProps;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<PortalHostViewProps const>(props);

  std::string nameStr = newViewProps.name;
  NSString *newName = nameStr.empty() ? nil : [NSString stringWithUTF8String:nameStr.c_str()];

  if (![self.registeredName isEqualToString:newName]) {
    if (self.registeredName) {
      [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName viewTag:self.tag];
    }
    self.registeredName = newName;
    if (newName) {
      [[PortalRegistry sharedInstance] registerHost:self withName:newName];
    }
  }

  [super updateProps:props oldProps:oldProps];
}

- (NSInteger)nextInsertionIndexForChildAt:(NSInteger)childIndex
{
  if (!self.isInBatch) {
    self.isInBatch = YES;
    self.batchBaseIndex = (NSInteger)self.subviews.count;
    __weak PortalHostView *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
      weakSelf.isInBatch = NO;
    });
  }
  return MIN(self.batchBaseIndex + childIndex, (NSInteger)self.subviews.count);
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];

  self.isInBatch = NO;
  self.batchBaseIndex = 0;

  // Unregister before recycling so a stale registeredName doesn't cause
  // this view to unregister a DIFFERENT host's entry when it's reused
  // with a new name.
  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName viewTag:self.tag];
    self.registeredName = nil;
  }
}

- (void)dealloc
{
  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName viewTag:self.tag];
  }
}

Class<RCTComponentViewProtocol> PortalHostViewCls(void)
{
  return PortalHostView.class;
}

@end
