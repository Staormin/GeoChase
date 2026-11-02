<template>
  <div ref="layersPanel" class="layers-panel">
    <div class="project-heading">
      <h1>{{ projectsStore.activeProject?.name || $t('workspace.noProject') }}</h1>

      <p v-if="!projectsStore.activeProject">{{ $t('workspace.projectHint') }}</p>

      <v-btn
        v-if="!projectsStore.activeProject"
        block
        class="mt-3"
        color="primary"
        prepend-icon="mdi-plus"
        variant="flat"
        @click="uiStore.openModal('newProjectModal')"
        >{{ $t('project.newProject') }}</v-btn
      >
    </div>

    <div class="layers-heading">
      <h2 class="layers-panel-title">{{ $t('layers.title') }}</h2>

      <span class="element-count">{{ elementCount }}</span>

      <v-btn
        class="ml-auto"
        color="primary"
        icon="mdi-folder-plus-outline"
        size="small"
        :title="$t('layers.createGroup')"
        variant="text"
        @click="openCreateGroupDialog"
      />
    </div>

    <div :aria-label="$t('layers.globalVisibility')" class="visibility-controls" role="group">
      <button
        v-for="category in visibilityCategories"
        :key="category.type"
        :aria-keyshortcuts="visibilityShortcut(category.key)"
        :aria-label="categoryVisibilityTitle(category.type)"
        :aria-pressed="areAllTargetsVisible(categoryVisibilityTargets(category.type))"
        class="visibility-button"
        :class="{
          'visibility-button-active': areAllTargetsVisible(
            categoryVisibilityTargets(category.type)
          ),
        }"
        :data-visibility-category="category.type"
        :disabled="categoryVisibilityTargets(category.type).length === 0"
        :title="`${categoryVisibilityTitle(category.type)} · ${visibilityShortcut(category.key)}`"
        type="button"
        @click="toggleVisibilityTargets(categoryVisibilityTargets(category.type))"
      >
        <v-icon :icon="category.icon" size="18" />
      </button>

      <span aria-hidden="true" class="visibility-divider" />

      <button
        :aria-keyshortcuts="visibilityShortcut(mapVisibilityKey)"
        :aria-label="
          $t(uiStore.mapBackgroundVisible ? 'layers.hideMapBackground' : 'layers.showMapBackground')
        "
        :aria-pressed="uiStore.mapBackgroundVisible"
        class="visibility-button"
        :class="{ 'visibility-button-active': uiStore.mapBackgroundVisible }"
        data-testid="toggle-map-background"
        :title="`${$t(uiStore.mapBackgroundVisible ? 'layers.hideMapBackground' : 'layers.showMapBackground')} · ${visibilityShortcut(mapVisibilityKey)}`"
        type="button"
        @click="uiStore.mapBackgroundVisible = !uiStore.mapBackgroundVisible"
      >
        <v-icon icon="mdi-map-outline" size="18" />
      </button>
    </div>

    <!-- Search bar (only show when there are elements) -->
    <div v-if="!layersStore.isEmpty || layersStore.elementGroups.length > 0" class="mb-3">
      <v-text-field
        v-model="searchQuery"
        class="layers-search"
        clearable
        density="compact"
        hide-details
        :placeholder="$t('layers.filterPlaceholder')"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
      />
    </div>

    <!-- Empty state -->
    <div v-if="layersStore.isEmpty && layersStore.elementGroups.length === 0" class="layers-empty">
      <svg aria-hidden="true" class="empty-map" fill="none" viewBox="0 0 280 170">
        <path
          d="M24 38 95 24 180 40 256 22V139L180 154 95 139 24 154Z"
          fill="#edf4f3"
          stroke="#cbdddd"
        />

        <path d="M95 24V139M180 40V154" stroke="#cbdddd" />

        <path
          d="M25 96C65 37 104 112 143 61S206 103 256 65M24 127C71 81 96 148 156 111S217 135 256 102"
          stroke="#d5e4dd"
          stroke-width="10"
        />

        <circle cx="158" cy="84" r="35" stroke="#7da9aa" stroke-dasharray="4 5" />

        <path
          d="m66 114 48-11 44-19 57-33"
          stroke="#176b70"
          stroke-dasharray="5 5"
          stroke-width="2"
        />

        <circle cx="66" cy="114" fill="#fff" r="5" stroke="#176b70" stroke-width="2" />

        <path
          d="M158 61a14 14 0 0 1 14 14c0 11-14 24-14 24s-14-13-14-24a14 14 0 0 1 14-14Z"
          fill="#176b70"
        />

        <circle cx="158" cy="75" fill="white" r="5" />
        <path d="m212 38 6 13-6 13-6-13Z" fill="#be892f" />
      </svg>

      <button class="empty-guide" type="button" @click="uiStore.setShowTutorial(true)">
        {{ $t('workspace.discover') }}<v-icon icon="mdi-arrow-right" size="17" />
      </button>
    </div>

    <!-- No results state -->
    <div
      v-else-if="
        filteredCircles.length === 0 &&
        filteredImages.length === 0 &&
        filteredRoutes.length === 0 &&
        filteredLines.length === 0 &&
        filteredPoints.length === 0 &&
        filteredElementGroups.length === 0 &&
        filteredPolygons.length === 0 &&
        filteredNotes.length === 0
      "
      class="layers-empty"
    >
      <p>{{ $t('layers.noMatch', { query: searchQuery }) }}</p>
    </div>

    <!-- Layers list -->
    <div v-else class="layers-list">
      <div
        v-for="group in filteredElementGroups"
        :key="group.id"
        class="element-group"
        :class="{ 'element-group-drop-target': dropGroupTargetId === group.id }"
        :data-element-group-id="group.id"
      >
        <div class="layers-section-header">
          <button
            class="layers-section-title"
            type="button"
            @click="toggleElementGroupExpanded(group.id)"
          >
            <v-icon icon="mdi-folder-outline" size="16" />
            <span class="group-title-text">{{ group.name }}</span>
            <span class="element-count">{{ groupMembers(group.id).length }}</span>

            <span aria-hidden="true" class="collapse-icon">{{
              expandedElementGroups[group.id] === false ? '▶' : '▼'
            }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              :disabled="groupVisibilityTargets(group).length === 0"
              :icon="isElementGroupVisible(group) ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="$t(isElementGroupVisible(group) ? 'layers.groupHide' : 'layers.groupShow')"
              variant="text"
              @click.stop="toggleElementGroupVisibility(group)"
            />

            <v-btn
              icon="mdi-pencil"
              size="x-small"
              :title="$t('layers.editGroup')"
              variant="text"
              @click.stop="openEditGroupDialog(group.id)"
            />

            <v-btn
              color="error"
              icon="mdi-folder-remove-outline"
              size="x-small"
              :title="$t('layers.groupDelete')"
              variant="text"
              @click.stop="removeElementGroup(group.id)"
            />
          </div>
        </div>

        <div v-show="expandedElementGroups[group.id] !== false" class="layer-items">
          <div
            v-for="member in displayedGroupMembers(group)"
            :key="`${member.type}:${member.element.id}`"
            class="layer-item group-member-item"
            :class="[
              dropClasses(member.type, member.element.id),
              {
                'layer-item-hidden': !uiStore.isElementVisible(member.type, member.element.id),
              },
            ]"
            :data-group-id="group.id"
            :data-layer-id="member.element.id"
            :data-layer-type="member.type"
            role="button"
            tabindex="0"
            @click="handleGroupMemberClick(member)"
            @keydown.enter="handleGroupMemberClick(member)"
            @keydown.space.prevent="handleGroupMemberClick(member)"
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, member.type, member.element.id)"
            @pointerenter="hoverSidebarElement(member.type, member.element.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div class="layer-item-info">
              <div class="layer-item-name">{{ groupMemberName(member) }}</div>
              <div class="layer-item-type">{{ groupMemberDetail(member) }}</div>
            </div>

            <div class="layer-item-actions" @click.stop>
              <LayerContextMenu
                v-if="member.type !== 'note'"
                :element-id="member.element.id"
                :element-type="member.type"
                in-group
                @delete="handleDeleteElement"
                @edit="handleGroupMemberEdit(member)"
                @remove-from-group="ungroupElement"
              />

              <v-menu v-else location="bottom">
                <template #activator="{ props }"
                  ><v-btn v-bind="props" icon="mdi-dots-vertical" size="x-small" variant="text"
                /></template>

                <v-list density="compact">
                  <v-list-item @click="toggleNoteVisibility(member.element)"
                    ><template #prepend
                      ><v-icon
                        :icon="
                          uiStore.isElementVisible('note', member.element.id)
                            ? 'mdi-eye'
                            : 'mdi-eye-off'
                        "
                        size="small"
                    /></template>

                    <v-list-item-title>{{
                      $t(
                        uiStore.isElementVisible('note', member.element.id)
                          ? 'contextMenu.hide'
                          : 'contextMenu.show'
                      )
                    }}</v-list-item-title></v-list-item
                  >

                  <v-list-item @click="ungroupElement('note', member.element.id)"
                    ><v-list-item-title>{{
                      $t('contextMenu.removeFromGroup')
                    }}</v-list-item-title></v-list-item
                  >

                  <v-list-item @click="handleEditNote(member.element)"
                    ><v-list-item-title>{{ $t('common.edit') }}</v-list-item-title></v-list-item
                  >

                  <v-list-item @click="handleDeleteNote(member.element)"
                    ><v-list-item-title>{{ $t('common.delete') }}</v-list-item-title></v-list-item
                  >
                </v-list>
              </v-menu>
            </div>
          </div>

          <p v-if="displayedGroupMembers(group).length === 0" class="group-no-match">
            {{ $t('layers.groupNoMatches') }}
          </p>
        </div>
      </div>

      <!-- Circles -->
      <div v-if="filteredCircles.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="circlesExpanded"
            class="layers-section-title"
            type="button"
            @click="circlesExpanded = !circlesExpanded"
          >
            {{
              $t('layers.circlesSection', {
                count: filteredCircles.length,
                total: searchQuery ? layersStore.circleCount : null,
              })
            }}

            <span aria-hidden="true" class="collapse-icon">{{ circlesExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allCirclesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allCirclesVisible ? $t('layers.hideAllCircles') : $t('layers.showAllCircles')"
              variant="text"
              @click.stop="toggleAllElementsOfType('circle')"
            />
          </div>
        </div>

        <div v-show="circlesExpanded" class="layer-items">
          <div
            v-for="circle in filteredCircles"
            :key="circle.id"
            class="layer-item"
            :class="{
              ...dropClasses('circle', circle.id),
              'layer-item-hidden': circle.id && !uiStore.isElementVisible('circle', circle.id),
            }"
            :data-layer-id="circle.id"
            data-layer-type="circle"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'circle', circle.id)"
            @pointerenter="hoverSidebarElement('circle', circle.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @click="handleGoTo('circle', circle)"
              @keydown.enter="handleGoTo('circle', circle)"
              @keydown.space.prevent="handleGoTo('circle', circle)"
            >
              <div class="layer-item-name">{{ circle.name }}</div>

              <div class="layer-item-type">
                {{ $t('common.radius') }} : {{ formatDistance(circle.radius) }}
              </div>
            </div>

            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="circle.id"
                :element-id="circle.id"
                element-type="circle"
                @delete="handleDeleteElement"
                @edit="handleEditCircle(circle)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Line segments -->
      <div v-if="filteredLines.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="linesExpanded"
            class="layers-section-title"
            type="button"
            @click="linesExpanded = !linesExpanded"
          >
            {{ $t('layers.lines') }} ({{ filteredLines.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.lineSegmentCount}` : '' }})

            <span aria-hidden="true" class="collapse-icon">{{ linesExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allLinesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allLinesVisible ? 'Hide all lines' : 'Show all lines'"
              variant="text"
              @click.stop="toggleAllElementsOfType('lineSegment')"
            />
          </div>
        </div>

        <div v-show="linesExpanded" class="layer-items">
          <div
            v-for="line in filteredLines"
            :key="line.id"
            class="layer-item"
            :class="{
              ...dropClasses('lineSegment', line.id),
              'layer-item-hidden': line.id && !uiStore.isElementVisible('lineSegment', line.id),
            }"
            :data-layer-id="line.id"
            data-layer-type="lineSegment"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'lineSegment', line.id)"
            @pointerenter="hoverSidebarElement('lineSegment', line.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @click="handleGoTo('lineSegment', line)"
              @keydown.enter="handleGoTo('lineSegment', line)"
              @keydown.space.prevent="handleGoTo('lineSegment', line)"
            >
              <div class="layer-item-name">{{ line.name }}</div>

              <div class="layer-item-type">
                {{ $t('layers.lineSegmentType') }} • {{ getLineInfo(line) }}
              </div>
            </div>

            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="line.id"
                :element-id="line.id"
                element-type="lineSegment"
                @delete="handleDeleteElement"
                @edit="handleEditLineSegment(line)"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredImages.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="imagesExpanded"
            class="layers-section-title"
            type="button"
            @click="imagesExpanded = !imagesExpanded"
          >
            {{ $t('imageElement.plural') }} ({{ filteredImages.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.imageCount}` : '' }})

            <span aria-hidden="true" class="collapse-icon">{{ imagesExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allImagesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allImagesVisible ? $t('imageElement.hideAll') : $t('imageElement.showAll')"
              variant="text"
              @click.stop="toggleAllElementsOfType('image')"
            />
          </div>
        </div>

        <div v-show="imagesExpanded" class="layer-items">
          <div
            v-for="image in filteredImages"
            :key="image.id"
            class="layer-item"
            :class="{
              ...dropClasses('image', image.id),
              'layer-item-hidden': image.id && !uiStore.isElementVisible('image', image.id),
            }"
            :data-layer-id="image.id"
            data-layer-type="image"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'image', image.id)"
            @pointerenter="hoverSidebarElement('image', image.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @click="handleGoTo('image', image)"
              @keydown.enter="handleGoTo('image', image)"
              @keydown.space.prevent="handleGoTo('image', image)"
            >
              <div class="layer-item-name">{{ image.name }}</div>

              <div class="layer-item-type">{{ $t('imageElement.label') }}</div>
            </div>

            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="image.id"
                :element-id="image.id"
                element-type="image"
                @delete="handleDeleteElement"
                @edit="handleEditImage(image)"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredRoutes.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="routesExpanded"
            class="layers-section-title"
            type="button"
            @click="routesExpanded = !routesExpanded"
          >
            {{ $t('route.plural') }} ({{ filteredRoutes.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.routeCount}` : '' }})

            <span aria-hidden="true" class="collapse-icon">{{ routesExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allRoutesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allRoutesVisible ? $t('route.hideAll') : $t('route.showAll')"
              variant="text"
              @click.stop="toggleAllElementsOfType('route')"
            />
          </div>
        </div>

        <div v-show="routesExpanded" class="layer-items">
          <div
            v-for="route in filteredRoutes"
            :key="route.id"
            class="layer-item"
            :class="{
              ...dropClasses('route', route.id),
              'layer-item-hidden': route.id && !uiStore.isElementVisible('route', route.id),
            }"
            :data-layer-id="route.id"
            data-layer-type="route"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'route', route.id)"
            @pointerenter="hoverSidebarElement('route', route.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @click="handleGoTo('route', route)"
              @keydown.enter="handleGoTo('route', route)"
              @keydown.space.prevent="handleGoTo('route', route)"
            >
              <div class="layer-item-name">{{ route.name }}</div>

              <div class="layer-item-type">{{ $t('route.title') }} • {{ getRouteInfo(route) }}</div>
            </div>

            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="route.id"
                :element-id="route.id"
                element-type="route"
                @delete="handleDeleteElement"
                @edit="handleEditRoute(route)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Points -->
      <div v-if="filteredPoints.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="pointsExpanded"
            class="layers-section-title"
            type="button"
            @click="pointsExpanded = !pointsExpanded"
          >
            {{ $t('layers.points') }} ({{ filteredPoints.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.pointCount}` : '' }})

            <span aria-hidden="true" class="collapse-icon">{{ pointsExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allPointsVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allPointsVisible ? 'Hide all points' : 'Show all points'"
              variant="text"
              @click.stop="toggleAllElementsOfType('point')"
            />
          </div>
        </div>

        <div v-show="pointsExpanded" class="layer-items">
          <div
            v-for="point in filteredPoints"
            :key="point.id"
            class="layer-item"
            :class="{
              ...dropClasses('point', point.id),
              'layer-item-hidden': point.id && !uiStore.isElementVisible('point', point.id),
            }"
            :data-layer-id="point.id"
            data-layer-type="point"
            @click="handlePointClick(point)"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'point', point.id)"
            @pointerenter="hoverSidebarElement('point', point.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @keydown.enter="handlePointClick(point)"
              @keydown.space.prevent="handlePointClick(point)"
            >
              <div class="layer-item-name">{{ point.name }}</div>
              <div class="layer-item-type">{{ $t('layers.pointType') }}</div>
            </div>

            <div class="layer-item-actions" @click.stop>
              <LayerContextMenu
                v-if="point.id"
                :element-id="point.id"
                element-type="point"
                @delete="handleDeleteElement"
                @edit="handleEditPoint(point)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Polygons -->
      <div v-if="filteredPolygons.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="polygonsExpanded"
            class="layers-section-title"
            type="button"
            @click="polygonsExpanded = !polygonsExpanded"
          >
            {{ $t('layers.polygons') }} ({{ filteredPolygons.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.polygonCount}` : '' }})

            <span aria-hidden="true" class="collapse-icon">{{ polygonsExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allPolygonsVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allPolygonsVisible ? 'Hide all polygons' : 'Show all polygons'"
              variant="text"
              @click.stop="toggleAllElementsOfType('polygon')"
            />
          </div>
        </div>

        <div v-show="polygonsExpanded" class="layer-items">
          <div
            v-for="polygon in filteredPolygons"
            :key="polygon.id"
            class="layer-item"
            :class="{
              ...dropClasses('polygon', polygon.id),
              'layer-item-hidden': polygon.id && !uiStore.isElementVisible('polygon', polygon.id),
            }"
            :data-layer-id="polygon.id"
            data-layer-type="polygon"
            @click="handlePolygonClick(polygon)"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'polygon', polygon.id)"
            @pointerenter="hoverSidebarElement('polygon', polygon.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @keydown.enter="handlePolygonClick(polygon)"
              @keydown.space.prevent="handlePolygonClick(polygon)"
            >
              <div class="layer-item-name">{{ polygon.name }}</div>

              <div class="layer-item-type">
                {{ $t('layers.polygonType') }} ({{ polygon.pointIds.length }}
                {{ $t('common.points') }}) •
                {{ formatDistance(calculatePolygonPerimeter(polygon)) }} •
                {{ formatPolygonArea(polygon) }}
              </div>
            </div>

            <div class="layer-item-actions" @click.stop>
              <LayerContextMenu
                v-if="polygon.id"
                :element-id="polygon.id"
                element-type="polygon"
                @delete="handleDeleteElement"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="filteredNotes.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="notesExpanded"
            class="layers-section-title"
            type="button"
            @click="notesExpanded = !notesExpanded"
          >
            {{ $t('layers.notes') }} ({{ filteredNotes.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.noteCount}` : '' }})

            <span aria-hidden="true" class="collapse-icon">{{ notesExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allNotesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="
                $t(allNotesVisible ? 'layers.hideCategory' : 'layers.showCategory', {
                  category: $t('layers.visibilityCategories.note'),
                })
              "
              variant="text"
              @click.stop="toggleAllElementsOfType('note')"
            />
          </div>
        </div>

        <div v-show="notesExpanded" class="layer-items">
          <div
            v-for="note in filteredNotes"
            :key="note.id"
            class="layer-item"
            :class="{
              ...dropClasses('note', note.id),
              'layer-item-hidden': !uiStore.isElementVisible('note', note.id),
            }"
            :data-layer-id="note.id"
            data-layer-type="note"
            @click="handleNoteClick(note)"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'note', note.id)"
            @pointerenter="hoverSidebarElement('note', note.id)"
            @pointerleave="clearSidebarHover"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div class="layer-item-info">
              <div class="layer-item-name">{{ note.title }}</div>

              <div class="layer-item-type">
                {{
                  note.linkedElementType
                    ? `${$t('layers.linkedTo')} ${note.linkedElementType}`
                    : $t('layers.standaloneNote')
                }}
              </div>
            </div>

            <div class="layer-item-actions" @click.stop>
              <v-menu location="bottom">
                <template #activator="{ props }">
                  <v-btn
                    data-testid="note-context-menu-btn"
                    icon="mdi-dots-vertical"
                    size="x-small"
                    variant="text"
                    v-bind="props"
                  />
                </template>

                <v-list density="compact">
                  <v-list-item
                    data-testid="note-toggle-visibility"
                    @click="toggleNoteVisibility(note)"
                  >
                    <template #prepend>
                      <v-icon
                        :icon="
                          uiStore.isElementVisible('note', note.id) ? 'mdi-eye' : 'mdi-eye-off'
                        "
                        size="small"
                      />
                    </template>

                    <v-list-item-title>{{
                      $t(
                        uiStore.isElementVisible('note', note.id)
                          ? 'contextMenu.hide'
                          : 'contextMenu.show'
                      )
                    }}</v-list-item-title>
                  </v-list-item>

                  <v-list-item @click="handleEditNote(note)">
                    <template #prepend>
                      <v-icon icon="mdi-pencil" size="small" />
                    </template>

                    <v-list-item-title>{{ $t('common.edit') }}</v-list-item-title>
                  </v-list-item>

                  <v-list-item class="text-error" @click="handleDeleteNote(note)">
                    <template #prepend>
                      <v-icon color="error" icon="mdi-delete" size="small" />
                    </template>

                    <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="dragPreview"
      aria-hidden="true"
      class="layer-drag-preview"
      data-testid="layer-drag-preview"
      :style="{
        transform: `translate3d(${dragPreview.x}px, ${dragPreview.y}px, 0)`,
        width: `${dragPreview.width}px`,
        minHeight: `${dragPreview.height}px`,
      }"
    >
      <div class="layer-item-info">
        <div class="layer-item-name">{{ dragPreview.name }}</div>
        <div class="layer-item-type">{{ dragPreview.detail }}</div>
      </div>

      <v-icon icon="mdi-drag" size="small" />
    </div>
  </Teleport>

  <v-dialog v-model="groupDialogOpen" max-width="560">
    <v-card class="group-editor-card">
      <v-card-title>{{
        $t(editingElementGroupId ? 'layers.editGroup' : 'layers.createGroup')
      }}</v-card-title>

      <v-card-text>
        <v-text-field
          v-model="elementGroupName"
          autofocus
          counter="60"
          :label="$t('layers.groupName')"
          maxlength="60"
          variant="outlined"
          @keydown.enter.prevent="saveElementGroup"
        />

        <v-text-field
          v-model="groupItemSearch"
          clearable
          density="compact"
          hide-details
          :placeholder="$t('layers.groupSearch')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
        />

        <div class="group-member-picker">
          <div v-for="item in filteredGroupableItems" :key="item.key" class="group-picker-row">
            <v-checkbox
              v-model="selectedGroupMemberKeys"
              density="compact"
              hide-details
              :label="item.name"
              :value="item.key"
            />

            <span class="group-picker-type">{{ item.detail }}</span>
          </div>

          <p v-if="filteredGroupableItems.length === 0" class="group-no-match">
            {{ $t('layers.groupNoMatches') }}
          </p>
        </div>

        <p v-if="selectedGroupMemberKeys.length === 0" class="group-empty-hint">
          {{ $t('layers.groupEmpty') }}
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="groupDialogOpen = false">{{ $t('common.cancel') }}</v-btn>

        <v-btn
          color="primary"
          :disabled="!elementGroupName.trim()"
          variant="flat"
          @click="saveElementGroup"
          >{{ $t('layers.groupSave') }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import type {
  CircleElement,
  DrawingElement,
  ElementGroup,
  ImageElement,
  LineSegmentElement,
  NoteElement,
  PointElement,
  PolygonElement,
  RouteElement,
  VisibilityElementType,
} from '@/types/project';
import { toLonLat } from 'ol/proj';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import LayerContextMenu from '@/components/layers/LayerContextMenu.vue';
import { useDrawingContext, useMapContext } from '@/composables/mapContext';
import { useDistanceDisplay } from '@/composables/useDistanceDisplay';
import {
  mapVisibilityKey,
  useElementVisibility,
  visibilityCategories,
  visibilityShortcut,
  type VisibilityTarget,
} from '@/composables/useElementVisibility';
import { useProjectGeometry } from '@/composables/useProjectGeometry';
import { imageCorners } from '@/services/imageElements';
import { routeBounds } from '@/services/routing';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { type MapElementRequest, useUIStore } from '@/stores/ui';

const { formatDistance } = useDistanceDisplay();
const { t } = useI18n();
const { getDistance, calculateBearing, polygonArea } = useProjectGeometry();

const layersStore = useLayersStore();
const uiStore = useUIStore();
const projectsStore = useProjectsStore();
const elementCount = computed(
  () =>
    layersStore.circles.length +
    layersStore.images.length +
    layersStore.routes.length +
    layersStore.lineSegments.length +
    layersStore.points.length +
    layersStore.polygons.length +
    layersStore.notes.length
);
const drawing = useDrawingContext();
const { categoryVisibilityTargets, areAllTargetsVisible, toggleVisibilityTargets } =
  useElementVisibility(drawing);
const mapContainer = useMapContext();

const searchQuery = ref('');
type ListElementType = 'image' | 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon' | 'note';
type GroupableType = ListElementType;
type GroupMember =
  | { type: 'image'; element: ImageElement }
  | { type: 'route'; element: RouteElement }
  | { type: 'circle'; element: CircleElement }
  | { type: 'lineSegment'; element: LineSegmentElement }
  | { type: 'point'; element: PointElement }
  | { type: 'polygon'; element: PolygonElement }
  | { type: 'note'; element: NoteElement };
interface GroupableItem {
  key: string;
  type: GroupableType;
  id: string;
  name: string;
  detail: string;
}
const groupDialogOpen = ref(false);
const editingElementGroupId = ref<string | null>(null);
const elementGroupName = ref('');
const groupItemSearch = ref('');
const selectedGroupMemberKeys = ref<string[]>([]);
const expandedElementGroups = ref<Record<string, boolean>>({});
const draggedElement = ref<{ type: ListElementType; id: string } | null>(null);
const dropTarget = ref<{
  type: ListElementType;
  id: string;
  position: 'before' | 'after' | 'link' | 'ungroup';
  ungroup?: boolean;
  groupId?: string;
} | null>(null);
const dropGroupTargetId = ref<string | null>(null);
const isDragging = ref(false);
const dragPreview = ref<{
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  detail: string;
} | null>(null);
let pendingDrag: {
  pointerId: number;
  x: number;
  y: number;
  type: ListElementType;
  id: string;
  handle: HTMLElement;
  bounds: DOMRect;
} | null = null;
let suppressClickUntil = 0;
let autoScrollInterval: ReturnType<typeof setInterval> | null = null;

// Filtered lists based on search query (using sorted arrays)
const filteredCircles = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedCircles.filter((circle) => !circle.groupId);
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedCircles.filter(
    (c) => !c.groupId && c.name.toLowerCase().includes(query)
  );
});

const filteredImages = computed(() =>
  layersStore.sortedImages.filter(
    (image) => !image.groupId && image.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);
const imagesExpanded = ref(true);
const allImagesVisible = computed(() => areAllTargetsVisible(sectionVisibilityTargets('image')));
function handleEditImage(image: ImageElement) {
  handleGoTo('image', image);
}

const filteredRoutes = computed(() =>
  layersStore.sortedRoutes.filter(
    (route) => !route.groupId && route.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);
const routesExpanded = ref(true);
const allRoutesVisible = computed(() => areAllTargetsVisible(sectionVisibilityTargets('route')));
function getRouteInfo(route: RouteElement) {
  return `${t(route.profile === 'car' ? 'route.car' : 'route.pedestrian')} • ${formatDistance(route.distance / 1000, 2)} • ${Math.ceil(route.duration / 60)} min • IGN`;
}
function handleEditRoute(route: RouteElement) {
  uiStore.startEditing('route', route.id);
  uiStore.openModal('routeModal');
}

const filteredLines = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedLineSegments.filter((line) => !line.groupId);
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedLineSegments.filter(
    (l) => !l.groupId && l.name.toLowerCase().includes(query)
  );
});

const filteredPoints = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedPoints.filter((point) => !point.groupId);
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedPoints.filter((p) => !p.groupId && p.name.toLowerCase().includes(query));
});

const filteredPolygons = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedPolygons.filter((polygon) => !polygon.groupId);
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedPolygons.filter(
    (p) => !p.groupId && p.name.toLowerCase().includes(query)
  );
});

const filteredNotes = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedNotes.filter((note) => !note.groupId);
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedNotes.filter(
    (n) =>
      !n.groupId &&
      (n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query))
  );
});

const groupableItems = computed<GroupableItem[]>(() => [
  ...layersStore.sortedImages.map((image) => ({
    key: `image:${image.id}`,
    type: 'image' as const,
    id: image.id,
    name: image.name,
    detail: t('imageElement.title'),
  })),
  ...layersStore.sortedRoutes.map((route) => ({
    key: `route:${route.id}`,
    type: 'route' as const,
    id: route.id,
    name: route.name,
    detail: t('route.title'),
  })),
  ...layersStore.sortedCircles.map((circle) => ({
    key: `circle:${circle.id}`,
    type: 'circle' as const,
    id: circle.id,
    name: circle.name,
    detail: t('layers.circleType'),
  })),
  ...layersStore.sortedLineSegments.map((line) => ({
    key: `lineSegment:${line.id}`,
    type: 'lineSegment' as const,
    id: line.id,
    name: line.name,
    detail: t('layers.lineSegmentType'),
  })),
  ...layersStore.sortedPoints.map((point) => ({
    key: `point:${point.id}`,
    type: 'point' as const,
    id: point.id,
    name: point.name,
    detail: t('layers.pointType'),
  })),
  ...layersStore.sortedPolygons.map((polygon) => ({
    key: `polygon:${polygon.id}`,
    type: 'polygon' as const,
    id: polygon.id,
    name: polygon.name,
    detail: t('layers.polygonType'),
  })),
  ...layersStore.sortedNotes.map((note) => ({
    key: `note:${note.id}`,
    type: 'note' as const,
    id: note.id,
    name: note.title,
    detail: t('layers.notes'),
  })),
]);
const filteredGroupableItems = computed(() => {
  const query = groupItemSearch.value.trim().toLowerCase();
  return groupableItems.value.filter((item) => !query || item.name.toLowerCase().includes(query));
});
const filteredElementGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return layersStore.elementGroups.filter(
    (group) =>
      !query ||
      group.name.toLowerCase().includes(query) ||
      groupMembers(group.id).some((member) => groupMemberMatches(member, query))
  );
});

function groupMembers(groupId: string): GroupMember[] {
  const members: GroupMember[] = [
    ...layersStore.sortedImages
      .filter((item) => item.groupId === groupId)
      .map((element) => ({ type: 'image' as const, element })),
    ...layersStore.sortedRoutes
      .filter((item) => item.groupId === groupId)
      .map((element) => ({ type: 'route' as const, element })),
    ...layersStore.sortedCircles
      .filter((item) => item.groupId === groupId)
      .map((element) => ({ type: 'circle' as const, element })),
    ...layersStore.sortedLineSegments
      .filter((item) => item.groupId === groupId)
      .map((element) => ({ type: 'lineSegment' as const, element })),
    ...layersStore.sortedPoints
      .filter((item) => item.groupId === groupId)
      .map((element) => ({ type: 'point' as const, element })),
    ...layersStore.sortedPolygons
      .filter((item) => item.groupId === groupId)
      .map((element) => ({ type: 'polygon' as const, element })),
    ...layersStore.sortedNotes
      .filter((item) => item.groupId === groupId)
      .map((element) => ({ type: 'note' as const, element })),
  ];
  const order = new Map(
    (layersStore.elementGroups.find((group) => group.id === groupId)?.memberOrder ?? []).map(
      (key, index) => [key, index]
    )
  );
  return members.toSorted((a, b) => {
    const aOrder = order.get(`${a.type}:${a.element.id}`);
    const bOrder = order.get(`${b.type}:${b.element.id}`);
    if (aOrder === undefined && bOrder === undefined) return 0;
    if (aOrder === undefined) return 1;
    if (bOrder === undefined) return -1;
    return aOrder - bOrder;
  });
}

function groupMemberName(member: GroupMember): string {
  return member.type === 'note' ? member.element.title : member.element.name;
}

function groupMemberMatches(member: GroupMember, query: string): boolean {
  return (
    groupMemberName(member).toLowerCase().includes(query) ||
    (member.type === 'note' && member.element.content.toLowerCase().includes(query))
  );
}

function displayedGroupMembers(group: ElementGroup): GroupMember[] {
  const query = searchQuery.value.trim().toLowerCase();
  const members = groupMembers(group.id);
  return !query || group.name.toLowerCase().includes(query)
    ? members
    : members.filter((member) => groupMemberMatches(member, query));
}

function groupMemberDetail(member: GroupMember): string {
  return t(
    (
      {
        image: 'imageElement.title',
        route: 'route.title',
        circle: 'layers.circleType',
        lineSegment: 'layers.lineSegmentType',
        point: 'layers.pointType',
        polygon: 'layers.polygonType',
        note: 'layers.notes',
      } as const
    )[member.type]
  );
}

function toggleElementGroupExpanded(groupId: string) {
  expandedElementGroups.value[groupId] = expandedElementGroups.value[groupId] === false;
}

function categoryVisibilityTitle(type: VisibilityElementType): string {
  const action = areAllTargetsVisible(categoryVisibilityTargets(type))
    ? 'hideCategory'
    : 'showCategory';
  return t(`layers.${action}`, { category: t(`layers.visibilityCategories.${type}`) });
}

function groupVisibilityTargets(group: ElementGroup): VisibilityTarget[] {
  return displayedGroupMembers(group).map((member) => ({
    type: member.type,
    id: member.element.id,
  }));
}

function sectionVisibilityTargets(type: VisibilityElementType): VisibilityTarget[] {
  const sections = {
    image: filteredImages,
    route: filteredRoutes,
    circle: filteredCircles,
    lineSegment: filteredLines,
    point: filteredPoints,
    polygon: filteredPolygons,
    note: filteredNotes,
  };
  return sections[type].value.map((element) => ({ type, id: element.id }));
}

function isElementGroupVisible(group: ElementGroup): boolean {
  return areAllTargetsVisible(groupVisibilityTargets(group));
}

function toggleElementGroupVisibility(group: ElementGroup) {
  toggleVisibilityTargets(groupVisibilityTargets(group));
}

function openCreateGroupDialog() {
  editingElementGroupId.value = null;
  elementGroupName.value = '';
  groupItemSearch.value = '';
  selectedGroupMemberKeys.value = [];
  groupDialogOpen.value = true;
}

function openEditGroupDialog(groupId: string) {
  const group = layersStore.elementGroups.find((item) => item.id === groupId);
  if (!group) return;
  editingElementGroupId.value = groupId;
  elementGroupName.value = group.name;
  groupItemSearch.value = '';
  selectedGroupMemberKeys.value = groupMembers(groupId).map(
    (member) => `${member.type}:${member.element.id}`
  );
  groupDialogOpen.value = true;
}

function getGroupableElement(type: GroupableType, id: string) {
  return {
    image: layersStore.images,
    route: layersStore.routes,
    circle: layersStore.circles,
    lineSegment: layersStore.lineSegments,
    point: layersStore.points,
    polygon: layersStore.polygons,
    note: layersStore.notes,
  }[type].find((item) => item.id === id);
}

function saveElementGroup() {
  const name = elementGroupName.value.trim();
  if (!name) return;
  const group = editingElementGroupId.value
    ? layersStore.elementGroups.find((item) => item.id === editingElementGroupId.value)
    : layersStore.createElementGroup(name);
  if (!group) return;
  layersStore.updateElementGroup(group.id, name);
  const selected = new Set(selectedGroupMemberKeys.value);
  for (const item of groupableItems.value) {
    const element = getGroupableElement(item.type, item.id);
    if (selected.has(item.key)) {
      if (element?.groupId !== group.id) layersStore.setElementGroup(item.type, item.id, group.id);
    } else if (element?.groupId === group.id) {
      layersStore.setElementGroup(item.type, item.id);
    }
  }
  expandedElementGroups.value[group.id] = true;
  groupDialogOpen.value = false;
}

function removeElementGroup(groupId: string) {
  const group = layersStore.elementGroups.find((item) => item.id === groupId);
  if (group && confirm(t('layers.groupDeleteConfirm', { name: group.name }))) {
    layersStore.deleteElementGroup(groupId);
    delete expandedElementGroups.value[groupId];
  }
}

function ungroupElement(type: string, id: string) {
  if (['image', 'route', 'circle', 'lineSegment', 'point', 'polygon', 'note'].includes(type)) {
    layersStore.setElementGroup(type as GroupableType, id);
  }
}

function handleGroupMemberClick(member: GroupMember) {
  if (member.type === 'note') handleNoteClick(member.element);
  else handleGoTo(member.type, member.element);
}

function handleGroupMemberEdit(member: GroupMember) {
  switch (member.type) {
    case 'image': {
      handleEditImage(member.element);
      break;
    }
    case 'route': {
      handleEditRoute(member.element);
      break;
    }
    case 'circle': {
      handleEditCircle(member.element);
      break;
    }
    case 'lineSegment': {
      handleEditLineSegment(member.element);
      break;
    }
    case 'point': {
      handleEditPoint(member.element);
      break;
    }
    case 'note': {
      handleEditNote(member.element);
      break;
    }
  }
}

// Calculate polygon perimeter in kilometers
function calculatePolygonPerimeter(polygon: PolygonElement): number {
  if (!polygon.pointIds || polygon.pointIds.length < 3) {
    return 0;
  }

  // Resolve point IDs to coordinates
  const points = polygon.pointIds
    .map((pointId) => layersStore.points.find((p) => p.id === pointId)?.coordinates)
    .filter((p): p is { lat: number; lon: number } => p !== undefined);

  if (points.length < 3) {
    return 0;
  }

  let perimeter = 0;

  // Calculate distance between consecutive points
  for (let i = 0; i < points.length; i++) {
    const currentPoint = points[i];
    const nextPoint = points[(i + 1) % points.length]; // Wrap around to first point

    if (currentPoint && nextPoint) {
      // getDistance returns meters, so convert to km
      const distance =
        getDistance([currentPoint.lon, currentPoint.lat], [nextPoint.lon, nextPoint.lat]) / 1000;
      perimeter += distance;
    }
  }

  return perimeter;
}

function formatPolygonArea(polygon: PolygonElement): string {
  const points = polygon.pointIds.flatMap((id) => {
    const point = layersStore.points.find((point) => point.id === id);
    return point ? [point.coordinates] : [];
  });
  const area = polygonArea(points);
  return area >= 1_000_000 ? `${(area / 1_000_000).toFixed(2)} km²` : `${Math.round(area)} m²`;
}

// Format distance for display

// Collapse states for each section
const circlesExpanded = ref(true);
const linesExpanded = ref(true);
const pointsExpanded = ref(true);
const polygonsExpanded = ref(true);
const notesExpanded = ref(true);
const layersPanel = ref<HTMLElement | null>(null);
let revealAnimation: Animation | undefined;

watch(
  () => uiStore.sidebarElementRequest,
  async (request, _previous, onCleanup) => {
    if (!request) return;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      revealAnimation?.cancel();
    });
    const sections = {
      circle: { expanded: circlesExpanded, items: filteredCircles },
      lineSegment: { expanded: linesExpanded, items: filteredLines },
      image: { expanded: imagesExpanded, items: filteredImages },
      route: { expanded: routesExpanded, items: filteredRoutes },
      point: { expanded: pointsExpanded, items: filteredPoints },
      polygon: { expanded: polygonsExpanded, items: filteredPolygons },
    };
    const section = sections[request.elementType];
    if (!section.items.value.some((item) => item.id === request.elementId)) {
      searchQuery.value = '';
    }
    section.expanded.value = true;
    const groupId = getGroupableElement(request.elementType, request.elementId)?.groupId;
    if (groupId) expandedElementGroups.value[groupId] = true;
    await nextTick();
    if (cancelled) return;
    const row = Array.from(
      layersPanel.value?.querySelectorAll<HTMLElement>('.layer-item') ?? []
    ).find(
      (item) =>
        item.dataset.layerType === request.elementType && item.dataset.layerId === request.elementId
    );
    if (!row) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
    const highlight = 'rgba(var(--v-theme-primary), 0.3)';
    revealAnimation = row.animate(
      reducedMotion
        ? [{ backgroundColor: highlight }, { backgroundColor: highlight }]
        : [
            { backgroundColor: 'transparent' },
            { backgroundColor: highlight, offset: 0.5 },
            { backgroundColor: 'transparent' },
          ],
      { duration: reducedMotion ? 1800 : 700, iterations: reducedMotion ? 1 : 3 }
    );
  }
);

const allCirclesVisible = computed(() => areAllTargetsVisible(sectionVisibilityTargets('circle')));
const allLinesVisible = computed(() =>
  areAllTargetsVisible(sectionVisibilityTargets('lineSegment'))
);
const allPointsVisible = computed(() => areAllTargetsVisible(sectionVisibilityTargets('point')));
const allNotesVisible = computed(() => areAllTargetsVisible(sectionVisibilityTargets('note')));
const allPolygonsVisible = computed(() =>
  areAllTargetsVisible(sectionVisibilityTargets('polygon'))
);

function getLineInfo(line: LineSegmentElement) {
  // Special handling for parallel mode
  if (line.mode === 'parallel') {
    return `parallel • ${line.longitude}°`;
  }

  if (!line.endpoint) {
    return `${line.mode} • (incomplete)`;
  }

  const segmentLength =
    getDistance([line.center.lon, line.center.lat], [line.endpoint.lon, line.endpoint.lat]) / 1000;
  const azimuth = calculateBearing(
    line.center.lat,
    line.center.lon,
    line.endpoint.lat,
    line.endpoint.lon
  );
  const inverseAzimuth = calculateBearing(
    line.endpoint.lat,
    line.endpoint.lon,
    line.center.lat,
    line.center.lon
  );
  const modeLabel =
    line.mode === 'coordinate'
      ? 'coordinate'
      : line.mode === 'azimuth'
        ? 'azimuth'
        : 'intersection';

  return `${modeLabel} • ${azimuth.toFixed(2)}° / ${inverseAzimuth.toFixed(2)}° • ${formatDistance(segmentLength, 2)}`;
}

function handleEditCircle(circle: CircleElement) {
  if (circle.id) {
    uiStore.startEditing('circle', circle.id);
    uiStore.openModal('circleModal');
  }
}

function handleEditLineSegment(line: LineSegmentElement) {
  if (line.id) {
    uiStore.startEditing('lineSegment', line.id);
    // Open the appropriate modal based on line mode
    switch (line.mode) {
      case 'coordinate': {
        uiStore.openModal('twoPointsLineModal');
        break;
      }
      case 'azimuth': {
        uiStore.openModal('azimuthLineModal');
        break;
      }
      case 'intersection': {
        uiStore.openModal('intersectionLineModal');
        break;
      }
      case 'parallel': {
        uiStore.openModal('parallelLineModal');
        break;
      }
      default: {
        uiStore.addToast('Cannot edit this line type', 'error');
      }
    }
  }
}

function handleEditPoint(point: PointElement) {
  if (point.id) {
    uiStore.startEditing('point', point.id);
    uiStore.openModal('pointModal');
  }
}

function handleDeleteElement(elementType: string, elementId: string) {
  // Use the drawing composable to delete from both map and store
  drawing.deleteElement(elementType, elementId);
}

function handleGoTo(elementType: MapElementRequest['elementType'], element: DrawingElement) {
  if (isDragging.value || Date.now() < suppressClickUntil) return;
  uiStore.selectedMapElement = { elementType, elementId: element.id };
  uiStore.mapElementHighlightRequest = { elementType, elementId: element.id };
  let lat: number;
  let lon: number;
  let zoom: number;

  switch (elementType) {
    case 'image': {
      const image = element as ImageElement;
      const corners = imageCorners(image).map((point) => toLonLat(point));
      mapContainer.flyToBoundsWithPanels([
        [Math.min(...corners.map((p) => p[1]!)), Math.min(...corners.map((p) => p[0]!))],
        [Math.max(...corners.map((p) => p[1]!)), Math.max(...corners.map((p) => p[0]!))],
      ]);
      uiStore.selectedImageId = image.id;
      return;
    }
    case 'circle': {
      const circle = element as CircleElement;
      lat = circle.center.lat;
      lon = circle.center.lon;
      // Calculate zoom based on radius: more zoomed in formula
      zoom = Math.max(6, Math.min(18, 15 - Math.log2(circle.radius / 1.5)));

      break;
    }
    case 'route': {
      mapContainer.flyToBoundsWithPanels(routeBounds(element as RouteElement));
      return;
    }
    case 'lineSegment': {
      const segment = element as LineSegmentElement;
      if (segment.mode === 'parallel') {
        // For parallel, center on the parallel's latitude
        lat = segment.longitude === undefined ? 0 : segment.longitude;
        lon = 0;
        zoom = 3;
      } else if (segment.endpoint) {
        // Center on segment midpoint
        lat = (segment.center.lat + segment.endpoint.lat) / 2;
        lon = (segment.center.lon + segment.endpoint.lon) / 2;

        // Calculate zoom based on line length: more zoomed in formula (getDistance returns meters, convert to km)
        const length =
          getDistance(
            [segment.center.lon, segment.center.lat],
            [segment.endpoint.lon, segment.endpoint.lat]
          ) / 1000;
        zoom = Math.max(6, Math.min(18, 15 - Math.log2(length / 1.5)));
      } else {
        // Fallback to segment start
        lat = segment.center.lat;
        lon = segment.center.lon;
        zoom = 13;
      }

      break;
    }
    case 'polygon': {
      const polygon = element as PolygonElement;
      // Calculate center of polygon by resolving point IDs to coordinates
      const points = polygon.pointIds
        .map((pointId) => layersStore.points.find((p) => p.id === pointId)?.coordinates)
        .filter((p): p is { lat: number; lon: number } => p !== undefined);

      if (points.length === 0) {
        console.warn('No valid points found for polygon');
        return;
      }

      const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
      const sumLon = points.reduce((sum, p) => sum + p.lon, 0);
      lat = sumLat / points.length;
      lon = sumLon / points.length;

      // Calculate bounds to determine zoom
      const lats = points.map((p) => p.lat);
      const lons = points.map((p) => p.lon);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      // Calculate diagonal distance of bounding box (getDistance returns meters, convert to km)
      const diagonal = getDistance([minLon, minLat], [maxLon, maxLat]) / 1000;
      zoom = Math.max(6, Math.min(18, 15 - Math.log2(diagonal / 1.5)));

      break;
    }
    default: {
      const point = element as PointElement;
      lat = point.coordinates.lat;
      lon = point.coordinates.lon;
      zoom = 16; // Closer zoom for points
    }
  }

  mapContainer.setCenter(lat, lon, zoom);
}

function clearSidebarHover() {
  uiStore.sidebarHoverRequest = null;
}

function hoverSidebarElement(type: ListElementType, id: string) {
  if (isDragging.value) return;
  if (type === 'note') {
    const note = layersStore.notes.find((item) => item.id === id);
    uiStore.sidebarHoverRequest =
      note?.linkedElementType && note.linkedElementId
        ? { elementType: note.linkedElementType, elementId: note.linkedElementId }
        : null;
  } else {
    uiStore.sidebarHoverRequest = { elementType: type, elementId: id };
  }
}

watch(
  () => [uiStore.sidebarOpen, projectsStore.activeProjectId, searchQuery.value],
  clearSidebarHover
);
onBeforeUnmount(clearSidebarHover);

function startElementDrag(event: PointerEvent, type: ListElementType, id: string) {
  if (
    event.button !== 0 ||
    pendingDrag ||
    (event.target as HTMLElement).closest('.layer-item-actions')
  )
    return;
  pendingDrag = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    type,
    id,
    handle: event.currentTarget as HTMLElement,
    bounds: (event.currentTarget as HTMLElement).getBoundingClientRect(),
  };
  document.addEventListener('keydown', cancelDragOnEscape);
  document.addEventListener('pointerup', cancelElementDrag);
  document.addEventListener('pointercancel', cancelElementDrag);
}

function moveElementDrag(event: PointerEvent) {
  if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return;
  if (!isDragging.value) {
    if (Math.hypot(event.clientX - pendingDrag.x, event.clientY - pendingDrag.y) < 5) return;
    isDragging.value = true;
    clearSidebarHover();
    draggedElement.value = { type: pendingDrag.type, id: pendingDrag.id };
    pendingDrag.handle.setPointerCapture(event.pointerId);
    const { handle, bounds } = pendingDrag;
    dragPreview.value = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      name: handle.querySelector('.layer-item-name')?.textContent || '',
      detail: handle.querySelector('.layer-item-type')?.textContent || '',
    };
    document.documentElement.classList.add('dragging-layer');
  }
  event.preventDefault();
  if (dragPreview.value) {
    dragPreview.value.x = pendingDrag.bounds.x + event.clientX - pendingDrag.x;
    dragPreview.value.y = pendingDrag.bounds.y + event.clientY - pendingDrag.y;
  }
  updateDropTarget(event);
}

function finishElementDrag(event: PointerEvent) {
  if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return;
  if (isDragging.value) {
    updateDropTarget(event);
    applyElementDrop();
  }
  cancelElementDrag();
}

function cancelDragOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') cancelElementDrag();
}

function cancelElementDrag() {
  stopAutoScroll();
  if (isDragging.value) suppressClickUntil = Date.now() + 100;
  const pending = pendingDrag;
  pendingDrag = null;
  isDragging.value = false;
  dragPreview.value = null;
  document.documentElement.classList.remove('dragging-layer');
  draggedElement.value = null;
  dropTarget.value = null;
  dropGroupTargetId.value = null;
  document.removeEventListener('keydown', cancelDragOnEscape);
  document.removeEventListener('pointerup', cancelElementDrag);
  document.removeEventListener('pointercancel', cancelElementDrag);
  if (pending?.handle.hasPointerCapture(pending.pointerId))
    pending.handle.releasePointerCapture(pending.pointerId);
}

function dropClasses(type: ListElementType, id: string) {
  const position =
    dropTarget.value?.type === type && dropTarget.value.id === id
      ? dropTarget.value.position
      : null;
  return {
    'layer-item-dragging': draggedElement.value?.type === type && draggedElement.value.id === id,
    'drag-over': position === 'link',
    'drop-before': position === 'before',
    'drop-after': position === 'after',
  };
}

function handlePointClick(point: PointElement) {
  if (!isDragging.value && Date.now() >= suppressClickUntil) {
    handleGoTo('point', point);
  }
}

function handlePolygonClick(polygon: PolygonElement) {
  if (Date.now() < suppressClickUntil) return;
  handleGoTo('polygon', polygon);
}

function updateDropTarget(event: PointerEvent) {
  dropTarget.value = null;
  dropGroupTargetId.value = null;
  stopAutoScroll();
  const source = draggedElement.value;
  if (!source || !pendingDrag) return;
  const sourceElement = getGroupableElement(source.type, source.id);
  const sourceGroupId = sourceElement?.groupId;
  const panel = pendingDrag.handle.closest('.v-navigation-drawer');
  const bounds = panel?.getBoundingClientRect();
  if (
    !bounds ||
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    return;
  const hitRow = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('.layer-item');
  const items = Array.from(
    (sourceGroupId
      ? panel?.querySelectorAll<HTMLElement>(
          `.layer-item[data-layer-type="${CSS.escape(source.type)}"]:not([data-group-id])`
        )
      : pendingDrag.handle.parentElement?.querySelectorAll<HTMLElement>('.layer-item')) ?? []
  );
  // Include category margins without treating them as point-link targets.
  const row =
    hitRow && panel?.contains(hitRow)
      ? hitRow
      : items.find((item) => {
          const rect = item.getBoundingClientRect();
          return event.clientY >= rect.top && event.clientY < rect.bottom;
        });
  const type = row?.dataset.layerType as ListElementType | undefined;
  const id = row?.dataset.layerId;
  const targetGroupId = row?.dataset.groupId;
  if (row && type && id) {
    handleAutoScroll(event, row);
    if (source.id === id) return;
    const rect = row.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    // Give reordering broad edges while retaining a central point-link target.
    // Cap the edges so wrapped point names remain available for linking.
    const edgeSize = Math.min(20, rect.height / 3);
    const isPointLink =
      !!hitRow &&
      source.type === 'point' &&
      type === 'point' &&
      sourceGroupId === targetGroupId &&
      offset >= edgeSize &&
      offset <= rect.height - edgeSize;
    const position = isPointLink ? 'link' : offset < rect.height / 2 ? 'before' : 'after';
    if (isPointLink) {
      dropTarget.value = { type, id, position: 'link' };
      return;
    }
    if (sourceGroupId && targetGroupId === sourceGroupId) {
      dropTarget.value = { type, id, position };
      return;
    }
    if (sourceGroupId && !targetGroupId) {
      dropTarget.value =
        type === source.type
          ? { type, id, position, ungroup: true }
          : { type, id, position: 'ungroup' };
      return;
    }
    if (targetGroupId) {
      dropTarget.value = { type, id, position, groupId: targetGroupId };
      return;
    }
    if (type === source.type) {
      dropTarget.value = { type, id, position };
    }
    return;
  }

  const groupTarget = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-element-group-id]');
  if (groupTarget?.dataset.elementGroupId) {
    dropGroupTargetId.value = groupTarget.dataset.elementGroupId;
    handleAutoScroll(event, groupTarget);
    return;
  }

  // Keep the existing category reordering affordance for ungrouped rows.
  if (items.length > 0) {
    handleAutoScroll(event, pendingDrag.handle);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    const edge =
      event.clientY < first.getBoundingClientRect().top
        ? { row: first, position: 'before' as const }
        : event.clientY >= last.getBoundingClientRect().bottom
          ? { row: last, position: 'after' as const }
          : null;
    const targetId = edge?.row.dataset.layerId;
    if (edge && targetId && targetId !== source.id) {
      dropTarget.value = {
        type: source.type,
        id: targetId,
        position: edge.position,
        ungroup: !!sourceGroupId,
      };
      return;
    }
  }
  // Dropping anywhere in the main notebook area removes a grouped item from its group.
  if (
    sourceGroupId &&
    document.elementFromPoint(event.clientX, event.clientY)?.closest('.layers-list')
  ) {
    dropTarget.value = { type: source.type, id: source.id, position: 'ungroup' };
    handleAutoScroll(event, pendingDrag.handle);
    return;
  }
}

function applyElementDrop() {
  const source = draggedElement.value;
  const target = dropTarget.value;
  const sourceElement = source && getGroupableElement(source.type, source.id);
  if (source && (target?.ungroup || target?.position === 'ungroup')) {
    layersStore.setElementGroup(source.type, source.id);
    if (target.position === 'before' || target.position === 'after') {
      layersStore.reorderElement(source.type, source.id, target.id, target.position);
    }
  } else if (source && target?.position === 'link') {
    const start = layersStore.points.find((point) => point.id === source.id);
    const end = layersStore.points.find((point) => point.id === target.id);
    if (start && end) createLineBetweenPoints(start, end);
  } else if (
    source &&
    target?.groupId &&
    (target.position === 'before' || target.position === 'after')
  ) {
    layersStore.setElementGroup(source.type, source.id, target.groupId);
    layersStore.reorderElementGroupMember(
      target.groupId,
      source.type,
      source.id,
      target.type,
      target.id,
      target.position
    );
  } else if (
    source &&
    sourceElement?.groupId &&
    target &&
    (target.position === 'before' || target.position === 'after')
  ) {
    layersStore.reorderElementGroupMember(
      sourceElement.groupId,
      source.type,
      source.id,
      target.type,
      target.id,
      target.position
    );
  } else if (source && dropGroupTargetId.value) {
    layersStore.setElementGroup(source.type, source.id, dropGroupTargetId.value);
  } else if (source && target && (target.position === 'before' || target.position === 'after')) {
    layersStore.reorderElement(target.type, source.id, target.id, target.position);
  }
}

function handleAutoScroll(event: PointerEvent, target: HTMLElement) {
  const scrollContainer = target.closest('.layers-list') as HTMLElement;

  if (!scrollContainer) {
    return;
  }

  // Get scroll container bounds
  const rect = scrollContainer.getBoundingClientRect();
  const scrollThreshold = 60; // pixels from edge to trigger scroll
  const scrollSpeed = 8; // pixels per interval

  // Calculate distance from edges
  const distanceFromTop = event.clientY - rect.top;
  const distanceFromBottom = rect.bottom - event.clientY;

  // Clear existing interval
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }

  // Scroll up if near top
  if (distanceFromTop < scrollThreshold && distanceFromTop > 0) {
    autoScrollInterval = setInterval(() => {
      scrollContainer.scrollTop -= scrollSpeed;
    }, 16); // ~60fps
  }
  // Scroll down if near bottom
  else if (distanceFromBottom < scrollThreshold && distanceFromBottom > 0) {
    autoScrollInterval = setInterval(() => {
      scrollContainer.scrollTop += scrollSpeed;
    }, 16); // ~60fps
  }
}

function createLineBetweenPoints(startPoint: PointElement, targetPoint: PointElement) {
  const existingLineIds = new Set(layersStore.lineSegments.map((line) => line.id));
  // getDistance returns meters, convert to km
  const distance =
    getDistance(
      [startPoint.coordinates.lon, startPoint.coordinates.lat],
      [targetPoint.coordinates.lon, targetPoint.coordinates.lat]
    ) / 1000;
  const azimuth = calculateBearing(
    startPoint.coordinates.lat,
    startPoint.coordinates.lon,
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon
  );
  const inverseAzimuth = calculateBearing(
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon,
    startPoint.coordinates.lat,
    startPoint.coordinates.lon
  );
  const lineName = `${startPoint.name} → ${targetPoint.name}`;

  drawing.drawLineSegment(
    startPoint.coordinates.lat,
    startPoint.coordinates.lon,
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon,
    lineName,
    'coordinate',
    distance,
    undefined,
    undefined,
    undefined,
    undefined
  );

  if (startPoint.groupId && startPoint.groupId === targetPoint.groupId) {
    const createdLine = layersStore.lineSegments.find((line) => !existingLineIds.has(line.id));
    if (createdLine) layersStore.setElementGroup('lineSegment', createdLine.id, startPoint.groupId);
  }

  uiStore.addToast(
    `Line created: ${lineName} (${formatDistance(distance, 2)} • ${azimuth.toFixed(1)}°/${inverseAzimuth.toFixed(1)}°)`,
    'success'
  );
}

function handleNoteClick(note: NoteElement) {
  if (Date.now() < suppressClickUntil) return;
  // If note is linked to an element, navigate to it
  if (note.linkedElementType && note.linkedElementId) {
    let element;
    const elementType = note.linkedElementType;

    switch (note.linkedElementType) {
      case 'image': {
        element = layersStore.images.find((image) => image.id === note.linkedElementId);
        break;
      }
      case 'circle': {
        element = layersStore.circles.find((c) => c.id === note.linkedElementId);
        break;
      }
      case 'route': {
        element = layersStore.routes.find((route) => route.id === note.linkedElementId);
        break;
      }
      case 'lineSegment': {
        element = layersStore.lineSegments.find((l) => l.id === note.linkedElementId);
        break;
      }
      case 'point': {
        element = layersStore.points.find((p) => p.id === note.linkedElementId);
        break;
      }
    }

    if (element) {
      handleGoTo(elementType, element);
    }
  }
}

function handleEditNote(note: NoteElement) {
  if (note.id) {
    uiStore.startEditing('note', note.id);
    uiStore.openModal('noteModal');
  }
}

function toggleNoteVisibility(note: NoteElement) {
  toggleVisibilityTargets([{ type: 'note', id: note.id }]);
}

function handleDeleteNote(note: NoteElement) {
  if (note.id && confirm(`Are you sure you want to delete the note "${note.title}"?`)) {
    layersStore.deleteNote(note.id);
    uiStore.addToast('Note deleted successfully!', 'success');
  }
}

function toggleAllElementsOfType(elementType: VisibilityElementType) {
  toggleVisibilityTargets(sectionVisibilityTargets(elementType));
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

onBeforeUnmount(cancelElementDrag);
</script>

<style scoped>
.layers-panel {
  background: rgb(var(--v-theme-surface));
  border: none;
  border-radius: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-heading {
  flex-shrink: 0;
  padding: 20px 22px;
  border-bottom: 1px solid var(--gc-border);
}
.project-heading h1 {
  font-size: 23px;
  line-height: 1.3;
  letter-spacing: -0.6px;
  margin: 0;
  overflow-wrap: anywhere;
}
.project-heading p {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 11px;
  color: var(--gc-muted);
  line-height: 1.6;
}
.visibility-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-shrink: 0;
  padding: 0 18px 12px 22px;
}
.visibility-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid var(--gc-border);
  border-radius: 6px;
  color: var(--gc-muted);
  background: transparent;
  cursor: pointer;
}
.visibility-button-active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.25);
}
.visibility-button:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.16);
}
.visibility-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.visibility-button:disabled {
  opacity: 0.35;
  cursor: default;
}
.visibility-divider {
  height: 18px;
  border-left: 1px solid var(--gc-border);
  margin: 0 3px;
}
.layers-heading {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 15px 18px 12px 22px;
  gap: 8px;
}
.layers-panel-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.element-count {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--gc-subtle);
  color: var(--gc-muted);
}
.layers-empty {
  padding: 12px 24px 32px;
  text-align: left;
  color: var(--gc-muted);
  font-size: 13px;
  line-height: 1.7;
  overflow-y: auto;
}
.empty-map {
  width: 100%;
  max-width: 280px;
  display: block;
  margin: 8px auto 22px;
}
.layers-empty p {
  margin-bottom: 22px;
}
.empty-guide {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
  padding: 14px 8px;
  color: var(--accent);
  font-weight: 500;
}
.mb-3 {
  padding: 0 16px 8px 16px;
  flex-shrink: 0;
  background: rgb(var(--v-theme-surface));
  z-index: 1;
}

.layers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.layers-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--gc-subtle);
  user-select: none;
  transition: background 0.2s ease;
  border-radius: 4px;
  margin-bottom: 4px;
}

.layers-section-header:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.layers-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  border: 0;
  text-align: left;
  min-height: 32px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.9);
  margin: 0;
  cursor: pointer;
  flex: 1;
}

.layers-section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.collapse-icon {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  transition: transform 0.2s ease;
  cursor: pointer;
  padding: 4px;
}

.layer-items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.layer-item {
  position: relative;
  cursor: grab;
  user-select: none;
  padding: 14px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.drop-before::before,
.drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.16);
  pointer-events: none;
  z-index: 1;
}
.drop-before::before {
  top: -2px;
}
.drop-after::after {
  bottom: -2px;
}

.layer-item:last-child {
  border-bottom: none;
}

.group-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-member-item {
  cursor: pointer;
}

.element-group-drop-target {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.group-no-match,
.group-empty-hint {
  margin: 8px 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 12px;
}

.group-member-picker {
  max-height: min(36dvh, 320px);
  margin-top: 8px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
  padding: 4px 10px;
}

.group-picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.group-picker-row:last-child {
  border-bottom: 0;
}

.group-picker-row :deep(.v-checkbox) {
  flex: 1;
  min-width: 0;
}

.group-picker-type {
  flex: 0 0 auto;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 11px;
}

.group-editor-card {
  display: flex;
  max-height: 88dvh;
  flex-direction: column;
}

.group-editor-card :deep(.v-card-text) {
  overflow-y: auto;
}

.layer-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 4px;
}

.layer-item-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.layer-item-name {
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: 14px;
}

.layer-item-type {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
}

.layer-item-actions {
  display: flex;
  gap: 6px;
  margin-left: 10px;
}

.layer-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  transition: all 0.2s ease;
  white-space: nowrap;
  font-weight: 500;
}

.layer-action-btn:hover {
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}

.layer-action-btn.delete:hover {
  background-color: rgba(var(--v-theme-error), 0.15);
  color: rgb(var(--v-theme-error));
}

.layer-action-btn.add:hover {
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}

.layer-item-hidden {
  opacity: 0.5;
}

.layer-item-hidden .layer-item-name {
  text-decoration: line-through;
}

/* Drag and drop styles */
:global(html.dragging-layer),
:global(html.dragging-layer *) {
  cursor: grabbing !important;
}

.layer-item-dragging {
  opacity: 0.25;
}

.layer-drag-preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  padding: 12px 8px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  box-shadow:
    0 8px 24px rgb(0 0 0 / 25%),
    0 0 0 1px rgba(var(--v-theme-primary), 0.5);
  pointer-events: none;
  user-select: none;
  will-change: transform;
}

.layer-item.drag-over {
  background: rgba(var(--v-theme-primary), 0.15) !important;
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-primary));
  border-radius: 4px;
}
</style>
