//
//  Teleport.mm
//  Pods
//
//  Created by Kiryl Ziusko on 07/10/2025.
//

#import "Teleport.h"

#import <React/RCTScheduler.h>
#import <React/RCTSurfacePresenter.h>
#import <React/RCTSurfacePresenterStub.h>
#import <react/renderer/components/TeleportViewSpec/TeleportCommitHook.h>

@implementation Teleport {
  __weak RCTSurfacePresenter* _surfacePresenter;
  std::shared_ptr<teleport::TeleportCommitHook> commitHook_;
}

- (void)install
{
 commitHook_ = std::make_shared<teleport::TeleportCommitHook>(_surfacePresenter.scheduler.uiManager);
}

- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)surfacePresenter
{
 _surfacePresenter = surfacePresenter;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeTeleportSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"Teleport";
}

@end