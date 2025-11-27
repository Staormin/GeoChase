<template>
  <v-dialog v-model="isOpen" max-width="900px">
    <v-card class="tutorial-card">
      <v-card-title class="tutorial-title d-flex align-center gap-2">
        <v-icon icon="mdi-book-open-variant" />
        {{ $t('tutorial.title') }}
      </v-card-title>

      <v-card-text class="tutorial-content">
        <v-tabs v-model="activeTab" class="tutorial-tabs">
          <!-- Getting Started Tab -->
          <v-tab value="getting-started">
            <v-icon class="me-2" icon="mdi-rocket" />
            {{ $t('tutorial.gettingStarted') }}
          </v-tab>

          <!-- Drawing Tab -->
          <v-tab value="drawing">
            <v-icon class="me-2" icon="mdi-pencil" />
            {{ $t('tutorial.drawingTools') }}
          </v-tab>

          <!-- Search Tab -->
          <v-tab value="search">
            <v-icon class="me-2" icon="mdi-magnify" />
            {{ $t('tutorial.searchExplore') }}
          </v-tab>

          <!-- Navigation Tab -->
          <v-tab value="navigation">
            <v-icon class="me-2" icon="mdi-navigation" />
            {{ $t('tutorial.navigation') }}
          </v-tab>

          <!-- Layers Tab -->
          <v-tab value="layers">
            <v-icon class="me-2" icon="mdi-layers" />
            {{ $t('tutorial.layers') }}
          </v-tab>

          <!-- Notes Tab -->
          <v-tab value="notes">
            <v-icon class="me-2" icon="mdi-note-text" />
            {{ $t('tutorial.notes') }}
          </v-tab>

          <!-- Coordinates Tab -->
          <v-tab value="coordinates">
            <v-icon class="me-2" icon="mdi-map-marker" />
            {{ $t('tutorial.coordinates') }}
          </v-tab>

          <!-- Projects Tab -->
          <v-tab value="projects">
            <v-icon class="me-2" icon="mdi-folder" />
            {{ $t('tutorial.projects') }}
          </v-tab>

          <!-- PDF Tab -->
          <v-tab value="pdf">
            <v-icon class="me-2" icon="mdi-file-pdf-box" />
            {{ $t('tutorial.pdf') }}
          </v-tab>

          <!-- Tips Tab -->
          <v-tab value="tips">
            <v-icon class="me-2" icon="mdi-lightbulb" />
            {{ $t('tutorial.tipsTricks') }}
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="mt-4">
          <!-- Getting Started -->
          <v-window-item value="getting-started">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.gettingStartedSection.heading') }}</h3>
              <p class="mb-2">
                {{ $t('tutorial.gettingStartedSection.intro') }}
              </p>
              <p class="mb-3">{{ $t('tutorial.gettingStartedSection.whatYouCanDo') }}</p>
              <ul class="tutorial-list">
                <li>
                  <strong>{{ $t('tutorial.gettingStartedSection.features.drawShapes') }}</strong>
                </li>
                <li>
                  <strong>{{
                    $t('tutorial.gettingStartedSection.features.searchLocations')
                  }}</strong>
                </li>
                <li>
                  <strong>{{
                    $t('tutorial.gettingStartedSection.features.findAlongPaths')
                  }}</strong>
                </li>
                <li>
                  <strong>{{ $t('tutorial.gettingStartedSection.features.viewElevation') }}</strong>
                </li>
                <li>
                  <strong>{{
                    $t('tutorial.gettingStartedSection.features.saveCoordinates')
                  }}</strong>
                </li>
                <li>
                  <strong>{{
                    $t('tutorial.gettingStartedSection.features.manageProjects')
                  }}</strong>
                </li>
                <li>
                  <strong>{{ $t('tutorial.gettingStartedSection.features.navigate') }}</strong>
                </li>
                <li>
                  <strong>{{ $t('tutorial.gettingStartedSection.features.exportGPX') }}</strong>
                </li>
              </ul>
            </div>
          </v-window-item>

          <!-- Drawing Tools -->
          <v-window-item value="drawing">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.drawingToolsSection.heading') }}</h3>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.drawingToolsSection.accessing.title') }}</h4>
                <p class="mb-2">
                  {{ $t('tutorial.drawingToolsSection.accessing.description') }}
                </p>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.drawingToolsSection.accessing.clickButtons') }}</li>
                  <li>{{ $t('tutorial.drawingToolsSection.accessing.collapse') }}</li>
                  <li>{{ $t('tutorial.drawingToolsSection.accessing.toolsInclude') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.drawingToolsSection.circle.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.drawingToolsSection.circle.description') }}</p>
                <ul class="tutorial-list">
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.circle.name') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.circle.center') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.circle.radius') }}</strong>
                  </li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.drawingToolsSection.line.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.drawingToolsSection.line.description') }}</p>
                <ul class="tutorial-list">
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.line.twoPoints') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.line.azimuth') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.line.intersection') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.line.parallel') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.line.freeHand') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.line.dragDrop') }}</strong>
                  </li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.drawingToolsSection.point.title') }}</h4>
                <p>
                  {{ $t('tutorial.drawingToolsSection.point.description') }}
                </p>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.drawingToolsSection.polygon.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.drawingToolsSection.polygon.description') }}</p>
                <ul class="tutorial-list">
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.polygon.selectPoints') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.polygon.visual') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.polygon.extractCenter') }}</strong>
                  </li>
                  <li>
                    <strong>{{ $t('tutorial.drawingToolsSection.polygon.useCase') }}</strong>
                  </li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- Search & Explore -->
          <v-window-item value="search">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.searchSection.heading') }}</h3>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.searchSection.addressSearch.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.searchSection.addressSearch.description') }}</p>
                <ol class="tutorial-list">
                  <li>{{ $t('tutorial.searchSection.addressSearch.step1') }}</li>
                  <li>{{ $t('tutorial.searchSection.addressSearch.step2') }}</li>
                  <li>{{ $t('tutorial.searchSection.addressSearch.step3') }}</li>
                  <li>{{ $t('tutorial.searchSection.addressSearch.step4') }}</li>
                  <li>{{ $t('tutorial.searchSection.addressSearch.step5') }}</li>
                </ol>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.searchSection.alongPath.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.searchSection.alongPath.description') }}</p>
                <ol class="tutorial-list">
                  <li>{{ $t('tutorial.searchSection.alongPath.step1') }}</li>
                  <li>{{ $t('tutorial.searchSection.alongPath.step2') }}</li>
                  <li>{{ $t('tutorial.searchSection.alongPath.step3') }}</li>
                  <li>{{ $t('tutorial.searchSection.alongPath.step4') }}</li>
                  <li>{{ $t('tutorial.searchSection.alongPath.step5') }}</li>
                  <li>{{ $t('tutorial.searchSection.alongPath.step6') }}</li>
                  <li>{{ $t('tutorial.searchSection.alongPath.step7') }}</li>
                  <li>{{ $t('tutorial.searchSection.alongPath.step8') }}</li>
                </ol>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.searchSection.tips.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.searchSection.tips.elevationData') }}</li>
                  <li>{{ $t('tutorial.searchSection.tips.altitudeFilter') }}</li>
                  <li>{{ $t('tutorial.searchSection.tips.filtered') }}</li>
                  <li>{{ $t('tutorial.searchSection.tips.nameFilter') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- Navigation -->
          <v-window-item value="navigation">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.navigationSection.heading') }}</h3>
              <p class="mb-3">{{ $t('tutorial.navigationSection.intro') }}</p>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.navigationSection.howTo.title') }}</h4>
                <ol class="tutorial-list">
                  <li>{{ $t('tutorial.navigationSection.howTo.step1') }}</li>
                  <li>{{ $t('tutorial.navigationSection.howTo.step2') }}</li>
                  <li>{{ $t('tutorial.navigationSection.howTo.step3') }}</li>
                  <li>{{ $t('tutorial.navigationSection.howTo.step4') }}</li>
                  <li>{{ $t('tutorial.navigationSection.howTo.step5') }}</li>
                </ol>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.navigationSection.tips.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.navigationSection.tips.speedAdjust') }}</li>
                  <li>{{ $t('tutorial.navigationSection.tips.zoomBehavior') }}</li>
                  <li>{{ $t('tutorial.navigationSection.tips.sidebarHide') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- Layers -->
          <v-window-item value="layers">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.layersSection.heading') }}</h3>
              <p class="mb-3">{{ $t('tutorial.layersSection.intro') }}</p>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.layersSection.accessing.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.layersSection.accessing.location') }}</li>
                  <li>{{ $t('tutorial.layersSection.accessing.toggle') }}</li>
                  <li>{{ $t('tutorial.layersSection.accessing.sections') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.layersSection.actions.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.layersSection.actions.click') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.menu') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.hideShow') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.edit') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.delete') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.searchAlong') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.navigate') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.bearings') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.createWith') }}</li>
                  <li>{{ $t('tutorial.layersSection.actions.addCenter') }}</li>
                </ul>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.layersSection.dragDrop.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.layersSection.dragDrop.description') }}</p>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.layersSection.dragDrop.drag') }}</li>
                  <li>{{ $t('tutorial.layersSection.dragDrop.autoCreate') }}</li>
                  <li>{{ $t('tutorial.layersSection.dragDrop.naming') }}</li>
                  <li>{{ $t('tutorial.layersSection.dragDrop.fastest') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- Notes -->
          <v-window-item value="notes">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.notesSection.heading') }}</h3>
              <p class="mb-3">{{ $t('tutorial.notesSection.intro') }}</p>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.notesSection.howToAdd.title') }}</h4>
                <ol class="tutorial-list">
                  <li>{{ $t('tutorial.notesSection.howToAdd.step1') }}</li>
                  <li>{{ $t('tutorial.notesSection.howToAdd.step2') }}</li>
                  <li>{{ $t('tutorial.notesSection.howToAdd.step3') }}</li>
                  <li>{{ $t('tutorial.notesSection.howToAdd.step4') }}</li>
                  <li>{{ $t('tutorial.notesSection.howToAdd.step5') }}</li>
                </ol>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.notesSection.managing.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.notesSection.managing.viewOnMap') }}</li>
                  <li>{{ $t('tutorial.notesSection.managing.edit') }}</li>
                  <li>{{ $t('tutorial.notesSection.managing.delete') }}</li>
                  <li>{{ $t('tutorial.notesSection.managing.onePerElement') }}</li>
                  <li>{{ $t('tutorial.notesSection.managing.saved') }}</li>
                </ul>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.notesSection.useCases.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.notesSection.useCases.clues') }}</li>
                  <li>{{ $t('tutorial.notesSection.useCases.observations') }}</li>
                  <li>{{ $t('tutorial.notesSection.useCases.whyCreated') }}</li>
                  <li>{{ $t('tutorial.notesSection.useCases.calculations') }}</li>
                  <li>{{ $t('tutorial.notesSection.useCases.reminders') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- Coordinates -->
          <v-window-item value="coordinates">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.coordinatesSection.heading') }}</h3>
              <p class="mb-3">{{ $t('tutorial.coordinatesSection.intro') }}</p>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.coordinatesSection.howToSave.title') }}</h4>
                <ol class="tutorial-list">
                  <li>{{ $t('tutorial.coordinatesSection.howToSave.step1') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.howToSave.step2') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.howToSave.step3') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.howToSave.step4') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.howToSave.step5') }}</li>
                </ol>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.coordinatesSection.managing.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.coordinatesSection.managing.access') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.managing.view') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.managing.edit') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.managing.delete') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.managing.sorted') }}</li>
                </ul>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.coordinatesSection.useCases.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.coordinatesSection.useCases.saveFirst') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.useCases.library') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.useCases.quickReference') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.useCases.reuse') }}</li>
                  <li>{{ $t('tutorial.coordinatesSection.useCases.autoGenerated') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- Projects -->
          <v-window-item value="projects">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.projectsSection.heading') }}</h3>
              <p class="mb-3">{{ $t('tutorial.projectsSection.intro') }}</p>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.projectsSection.accessing.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.projectsSection.accessing.icon') }}</li>
                  <li>{{ $t('tutorial.projectsSection.accessing.dropdown') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.projectsSection.projectActions.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.projectsSection.projectActions.newProject') }}</li>
                  <li>{{ $t('tutorial.projectsSection.projectActions.loadProject') }}</li>
                  <li>{{ $t('tutorial.projectsSection.projectActions.exportJSON') }}</li>
                  <li>{{ $t('tutorial.projectsSection.projectActions.importJSON') }}</li>
                  <li>{{ $t('tutorial.projectsSection.projectActions.exportGPX') }}</li>
                </ul>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.projectsSection.features.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.projectsSection.features.storage') }}</li>
                  <li>{{ $t('tutorial.projectsSection.features.autoSave') }}</li>
                  <li>{{ $t('tutorial.projectsSection.features.renameDelete') }}</li>
                  <li>{{ $t('tutorial.projectsSection.features.gpxExport') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- PDF Documents -->
          <v-window-item value="pdf">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.pdfSection.heading') }}</h3>
              <p class="mb-3">{{ $t('tutorial.pdfSection.intro') }}</p>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.pdfSection.uploading.title') }}</h4>
                <ol class="tutorial-list">
                  <li>{{ $t('tutorial.pdfSection.uploading.step1') }}</li>
                  <li>{{ $t('tutorial.pdfSection.uploading.step2') }}</li>
                  <li>{{ $t('tutorial.pdfSection.uploading.step3') }}</li>
                  <li>{{ $t('tutorial.pdfSection.uploading.step4') }}</li>
                </ol>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.pdfSection.viewing.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.pdfSection.viewing.openPanel') }}</li>
                  <li>{{ $t('tutorial.pdfSection.viewing.resize') }}</li>
                  <li>{{ $t('tutorial.pdfSection.viewing.navigate') }}</li>
                  <li>{{ $t('tutorial.pdfSection.viewing.zoom') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.pdfSection.passwordProtected.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.pdfSection.passwordProtected.description') }}</p>
                <ol class="tutorial-list">
                  <li>{{ $t('tutorial.pdfSection.passwordProtected.step1') }}</li>
                  <li>{{ $t('tutorial.pdfSection.passwordProtected.step2') }}</li>
                  <li>{{ $t('tutorial.pdfSection.passwordProtected.step3') }}</li>
                </ol>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.pdfSection.features.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.pdfSection.features.storage') }}</li>
                  <li>{{ $t('tutorial.pdfSection.features.perProject') }}</li>
                  <li>{{ $t('tutorial.pdfSection.features.persistent') }}</li>
                  <li>{{ $t('tutorial.pdfSection.features.delete') }}</li>
                  <li>{{ $t('tutorial.pdfSection.features.notExported') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>

          <!-- Tips & Tricks -->
          <v-window-item value="tips">
            <div class="tutorial-section">
              <h3 class="mb-3">{{ $t('tutorial.tipsSection.heading') }}</h3>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.tipsSection.keyboardShortcuts.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.tipsSection.keyboardShortcuts.arrows') }}</li>
                  <li>{{ $t('tutorial.tipsSection.keyboardShortcuts.z') }}</li>
                  <li>{{ $t('tutorial.tipsSection.keyboardShortcuts.esc') }}</li>
                  <li>{{ $t('tutorial.tipsSection.keyboardShortcuts.rightClick') }}</li>
                  <li>{{ $t('tutorial.tipsSection.keyboardShortcuts.alt') }}</li>
                  <li>{{ $t('tutorial.tipsSection.keyboardShortcuts.ctrl') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.tipsSection.precisionMode.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.tipsSection.precisionMode.description') }}</p>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.tipsSection.precisionMode.activate') }}</li>
                  <li>{{ $t('tutorial.tipsSection.precisionMode.lens') }}</li>
                  <li>{{ $t('tutorial.tipsSection.precisionMode.crosshair') }}</li>
                  <li>{{ $t('tutorial.tipsSection.precisionMode.sameZoom') }}</li>
                  <li>{{ $t('tutorial.tipsSection.precisionMode.deactivate') }}</li>
                  <li>{{ $t('tutorial.tipsSection.precisionMode.use') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.tipsSection.bearingsAnalysis.title') }}</h4>
                <p class="mb-2">{{ $t('tutorial.tipsSection.bearingsAnalysis.description') }}</p>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.tipsSection.bearingsAnalysis.openView') }}</li>
                  <li>{{ $t('tutorial.tipsSection.bearingsAnalysis.viewCalc') }}</li>
                  <li>{{ $t('tutorial.tipsSection.bearingsAnalysis.sort') }}</li>
                  <li>{{ $t('tutorial.tipsSection.bearingsAnalysis.navigate') }}</li>
                  <li>{{ $t('tutorial.tipsSection.bearingsAnalysis.use') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.tipsSection.drawingTips.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.tipsSection.drawingTips.saveFirst') }}</li>
                  <li>{{ $t('tutorial.tipsSection.drawingTips.quickLine') }}</li>
                  <li>
                    <strong>{{ $t('tutorial.tipsSection.drawingTips.freeHandMode.title') }}</strong>
                    <ul>
                      <li>{{ $t('tutorial.tipsSection.drawingTips.freeHandMode.setStart') }}</li>
                      <li>{{ $t('tutorial.tipsSection.drawingTips.freeHandMode.preview') }}</li>
                      <li>{{ $t('tutorial.tipsSection.drawingTips.freeHandMode.lockAzimuth') }}</li>
                      <li>
                        {{ $t('tutorial.tipsSection.drawingTips.freeHandMode.lockDistance') }}
                      </li>
                      <li>{{ $t('tutorial.tipsSection.drawingTips.freeHandMode.tooltip') }}</li>
                      <li>{{ $t('tutorial.tipsSection.drawingTips.freeHandMode.finalize') }}</li>
                      <li>{{ $t('tutorial.tipsSection.drawingTips.freeHandMode.predefined') }}</li>
                    </ul>
                  </li>
                  <li>{{ $t('tutorial.tipsSection.drawingTips.multipleLines') }}</li>
                  <li>{{ $t('tutorial.tipsSection.drawingTips.intersectionMode') }}</li>
                  <li>{{ $t('tutorial.tipsSection.drawingTips.azimuthMode') }}</li>
                  <li>{{ $t('tutorial.tipsSection.drawingTips.parallelMode') }}</li>
                  <li>{{ $t('tutorial.tipsSection.drawingTips.autoNames') }}</li>
                </ul>
              </div>

              <div class="tutorial-step mb-4">
                <h4 class="mb-2">{{ $t('tutorial.tipsSection.searchWorkflow.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.tipsSection.searchWorkflow.addressSearch') }}</li>
                  <li>{{ $t('tutorial.tipsSection.searchWorkflow.drawLine') }}</li>
                  <li>{{ $t('tutorial.tipsSection.searchWorkflow.searchAlong') }}</li>
                  <li>{{ $t('tutorial.tipsSection.searchWorkflow.filterAltitude') }}</li>
                  <li>{{ $t('tutorial.tipsSection.searchWorkflow.markFindings') }}</li>
                </ul>
              </div>

              <div class="tutorial-step">
                <h4 class="mb-2">{{ $t('tutorial.tipsSection.projectManagement.title') }}</h4>
                <ul class="tutorial-list">
                  <li>{{ $t('tutorial.tipsSection.projectManagement.saveFrequently') }}</li>
                  <li>{{ $t('tutorial.tipsSection.projectManagement.descriptiveNames') }}</li>
                  <li>{{ $t('tutorial.tipsSection.projectManagement.exportGPX') }}</li>
                  <li>{{ $t('tutorial.tipsSection.projectManagement.importGPX') }}</li>
                </ul>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="isOpen = false">{{ $t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const activeTab = ref('getting-started');

const isOpen = ref(false);

watch(
  () => uiStore.showTutorial,
  (newValue) => {
    isOpen.value = newValue;
  }
);

watch(isOpen, (newValue) => {
  if (!newValue) {
    uiStore.setShowTutorial(false);
  }
});
</script>

<style scoped>
.tutorial-card {
  background-color: #1e293b;
}

.tutorial-title {
  background-color: #0f172a;
  color: #ffffff;
}

.tutorial-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 24px;
  background-color: #1e293b;
}

.tutorial-tabs {
  background-color: #1e293b;
}

.tutorial-section {
  padding: 12px 0;
}

.tutorial-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 12px;
}

.tutorial-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #e0e7ff;
}

.tutorial-step {
  padding: 12px;
  background: transparent;
  border-left: 3px solid rgb(var(--v-theme-primary));
  border-radius: 4px;
}

.tutorial-list {
  margin: 8px 0;
  padding-left: 24px;
  color: #ffffff;
  font-size: 14px;
  line-height: 1.6;
}

.tutorial-list li {
  margin: 6px 0;
  color: #ffffff;
}

.tutorial-list strong {
  color: #e0e7ff;
  font-weight: 600;
}

p {
  color: #ffffff;
  font-size: 14px;
  line-height: 1.6;
}

:deep(.v-tab) {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.v-tab--selected) {
  color: #ffffff;
}

:deep(.v-window) {
  background-color: transparent;
}

:deep(.v-icon) {
  color: #94a3b8;
}

:deep(.v-tab--selected .v-icon) {
  color: #3b82f6;
}

:deep(.v-card-actions) {
  background-color: #0f172a;
}

:deep(.v-btn) {
  color: #ffffff;
}
</style>
