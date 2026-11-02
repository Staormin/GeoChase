<template>
  <FloatingDialog v-model="isOpen" blocking class="tutorial-fullscreen" fullscreen>
    <v-card
      class="tutorial-card d-flex flex-row overflow-hidden border bg-background"
      elevation="24"
      rounded="xl"
    >
      <v-sheet
        class="tutorial-sidebar flex-shrink-0 d-flex flex-column h-100 border-e bg-surface"
        width="290"
      >
        <div class="sidebar-header pa-6 border-b">
          <div class="d-flex align-center gap-3 mb-1">
            <v-avatar
              class="elevation-2 shadow-primary"
              color="primary"
              rounded="lg"
              size="38"
              variant="flat"
            >
              <v-icon color="white" icon="mdi-book-open-variant" size="20" />
            </v-avatar>

            <v-card-title
              class="text-h6 font-weight-black text-high-emphasis tracking-tight line-height-tight pa-0"
            >
              {{ $t('tutorial.title') }}
            </v-card-title>
          </div>

          <div class="text-caption text-medium-emphasis ml-12">
            {{ $t('tutorial.guideSubtitle') }}
          </div>
        </div>

        <v-tabs
          v-model="activeTabId"
          class="tutorial-tabs flex-grow-1 overflow-y-auto px-3 py-4"
          direction="vertical"
          hide-slider
        >
          <v-tab
            v-for="section in tutorialData"
            :key="section.id"
            :aria-label="sectionTitle(section.id)"
            class="modern-nav-item mb-1 rounded-lg justify-start"
            :value="section.id"
          >
            <v-icon :icon="section.icon" size="20" start />
            {{ sectionTitle(section.id) }}
          </v-tab>
        </v-tabs>

        <div class="sidebar-footer pa-4 border-t d-flex flex-column gap-3">
          <div class="text-center">
            <span
              class="text-caption text-medium-emphasis d-flex align-center justify-center gap-2"
            >
              <kbd class="modern-kbd px-2 py-1 rounded">ESC</kbd>
              {{ $t('tutorial.closeHint') }}
            </span>
          </div>
        </div>
      </v-sheet>

      <div
        class="tutorial-content-area v-window-item--active flex-grow-1 overflow-y-auto bg-background"
      >
        <v-container v-if="activeSection" class="pa-10" fluid>
          <div
            class="tutorial-section content-header mb-10 d-flex align-start justify-space-between"
          >
            <div>
              <h3 class="text-h3 font-weight-black text-high-emphasis mb-3 tracking-tight">
                {{ sectionTitle(activeSection.id) }}
              </h3>

              <p class="text-h6 text-medium-emphasis font-weight-regular max-width-700">
                {{ sectionIntro(activeSection.id, activeSection.intro) }}
              </p>
            </div>

            <v-btn color="medium-emphasis" rounded="xl" variant="tonal" @click="isOpen = false">
              <v-icon icon="mdi-close" start />
              {{ $t('common.close') }}
            </v-btn>
          </div>

          <div v-if="activeSection.id === 'getting-started'" class="welcome-dashboard">
            <v-row class="mb-4" dense>
              <v-col
                v-for="sub in activeSection.subsections"
                :key="sub.id"
                class="pa-3"
                cols="12"
                md="6"
              >
                <v-card
                  :aria-label="featureTitle(sub.id, sub.title)"
                  class="h-100 modern-feature-card pa-5 d-flex flex-column rounded-xl"
                  variant="flat"
                  @click="navigateTo(sub.linkTarget)"
                >
                  <div class="d-flex align-start gap-4 mb-3">
                    <v-avatar
                      class="flex-shrink-0"
                      color="primary"
                      rounded="lg"
                      size="46"
                      variant="tonal"
                    >
                      <v-icon :icon="sub.icon || 'mdi-compass'" size="24" />
                    </v-avatar>

                    <div class="pt-1">
                      <v-card-title
                        class="text-h6 font-weight-bold text-high-emphasis pa-0 mb-1 line-height-tight"
                      >
                        {{ featureTitle(sub.id, sub.title) }}
                      </v-card-title>

                      <v-card-text class="text-body-2 text-medium-emphasis pa-0">
                        {{ featureContent(sub.id, sub.content ?? '') }}
                      </v-card-text>
                    </div>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <div v-else class="content-blocks">
            <div
              v-for="sub in activeSection.subsections"
              :key="sub.id"
              class="tutorial-step modern-pedagogical-block mb-8 pa-6 rounded-xl bg-surface border"
              :data-testid="
                sub.id === 'proj-actions'
                  ? 'projection-tutorial'
                  : sub.id === 'draw-crossing'
                    ? 'crossing-point-tutorial'
                    : sub.id === 'draw-intersection-edit'
                      ? 'intersection-edit-tutorial'
                      : undefined
              "
            >
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="tutorial-step-heading">
                  <div
                    class="icon-wrapper d-flex flex-shrink-0 align-center justify-center rounded-lg bg-background border"
                  >
                    <v-icon color="primary" :icon="sub.icon || 'mdi-chevron-right'" size="20" />
                  </div>

                  <h4 class="text-h5 font-weight-bold text-high-emphasis">
                    {{ subsectionTitle(sub.id, sub.title) }}
                  </h4>
                </div>

                <v-chip
                  v-if="sub.badge"
                  class="font-weight-bold"
                  color="primary"
                  size="small"
                  variant="elevated"
                >
                  {{ subsectionBadge(sub.id, sub.badge) }}
                </v-chip>
              </div>

              <p
                v-if="sub.content"
                class="text-body-1 text-medium-emphasis mb-5 text-pre-wrap ml-12"
              >
                {{ subsectionContent(sub) }}
              </p>

              <div
                v-if="sub.items && sub.items.length > 0"
                class="bullets-container mt-2 pa-5 rounded-lg ml-12 bg-background border-dashed"
              >
                <ul class="tutorial-list">
                  <li v-for="(item, bIndex) in sub.items" :key="bIndex">
                    <strong v-if="detailLabel(sub, bIndex, item.label)" class="text-high-emphasis"
                      >{{ detailLabel(sub, bIndex, item.label) }}
                      <span class="text-primary mx-1">•</span>
                    </strong>

                    <span class="text-medium-emphasis">{{
                      detailText(sub, bIndex, item.text)
                    }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </v-container>
      </div>
    </v-card>
  </FloatingDialog>
</template>

<script lang="ts" setup>
// Le bloc script reste rigoureusement identique pour garantir la compatibilité
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
import { useUIStore } from '@/stores/ui';

interface DetailItem {
  label?: string;
  text: string;
}

interface Subsection {
  id: string;
  title: string;
  icon?: string;
  badge?: string;
  content?: string;
  linkTarget?: string;
  items?: DetailItem[];
}

interface Section {
  id: string;
  title: string;
  icon: string;
  intro: string;
  subsections: Subsection[];
}

const uiStore = useUIStore();
const { t, te } = useI18n();
const isOpen = ref(false);
const activeTabId = ref('getting-started');

/**
 * Assistant section: every text, example labels included, comes from
 * tutorial.assistantSection.<part> (title, content, labelN, itemN).
 */
const ASSISTANT_PARTS = [
  { part: 'connect', icon: 'mdi-key-variant', items: 4, content: true },
  { part: 'how', icon: 'mdi-head-cog-outline', items: 4, content: true },
  { part: 'places', icon: 'mdi-map-marker-plus-outline', items: 4, content: true },
  { part: 'constructions', icon: 'mdi-vector-intersection', items: 6, content: true },
  { part: 'analysis', icon: 'mdi-chart-line', items: 4, content: true },
  { part: 'edits', icon: 'mdi-pencil-outline', items: 6, content: true },
  {
    part: 'overlay',
    icon: 'mdi-image-filter-center-focus-weak',
    items: 4,
    content: true,
    badge: true,
  },
  { part: 'attachments', icon: 'mdi-paperclip', items: 4, content: true },
  { part: 'limits', icon: 'mdi-information-outline', items: 4, content: false },
];
const assistantKey = (part: string, key: string) => `tutorial.assistantSection.${part}.${key}`;
function assistantKeys(key: (part: string) => string) {
  return Object.fromEntries(ASSISTANT_PARTS.map(({ part }) => [`assistant-${part}`, key(part)]));
}

const DEFAULT_DATA: Section[] = [
  {
    id: 'getting-started',
    title: 'Premiers Pas',
    icon: 'mdi-rocket',
    intro: "Bienvenue dans l'interface cartographique. Voici les fonctionnalités principales :",
    subsections: [
      {
        id: 'feat-workspace',
        title: 'Repérer les commandes',
        icon: 'mdi-view-dashboard-outline',
        content:
          'Les outils principaux sont dans le bandeau du haut. « Construire » ouvre les tracés avancés.',
        linkTarget: 'drawing',
      },
      {
        id: 'feat-interface',
        title: 'Personnaliser l’espace de travail',
        icon: 'mdi-palette-outline',
        content:
          'Le menu ⋯ en haut à droite donne accès aux thèmes, à la langue et au dépôt GitHub.',
        linkTarget: 'interface',
      },
      {
        id: 'feat-draw',
        title: 'Tracer des formes',
        icon: 'mdi-pencil-ruler',
        content:
          'Points, cercles, lignes, itinéraires et polygones, avec des constructions avancées.',
        linkTarget: 'drawing',
      },
      {
        id: 'feat-search',
        title: 'Recherche de lieux',
        icon: 'mdi-magnify-expand',
        content:
          'La recherche d’adresse est au centre du bandeau supérieur ; choisissez aussi le fond de carte à droite.',
        linkTarget: 'search',
      },
      {
        id: 'feat-path',
        title: "Recherche le long d'un parcours",
        icon: 'mdi-map-marker-path',
        content: "Trouver des éléments à distance définie d'un itinéraire.",
        linkTarget: 'search',
      },
      {
        id: 'feat-elevation',
        title: 'Profils altimétriques',
        icon: 'mdi-chart-bell-curve-cumulative',
        content: "Analyser le relief et l'altitude des segments.",
        linkTarget: 'search',
      },
      {
        id: 'feat-points',
        title: 'Enregistrer des points',
        icon: 'mdi-map-marker',
        content: 'Gérer coordonnées et centres géométriques.',
        linkTarget: 'points',
      },
      {
        id: 'feat-projects',
        title: 'Gérer des projets',
        icon: 'mdi-folder-cog',
        content: 'Sauvegardes, projections et exports GPX.',
        linkTarget: 'projects',
      },
      {
        id: 'feat-assistant',
        title: '',
        icon: 'mdi-auto-fix',
        linkTarget: 'assistant',
      },
    ],
  },
  {
    id: 'interface',
    title: 'Interface et thèmes',
    icon: 'mdi-palette-outline',
    intro: 'Retrouvez les commandes dans la nouvelle disposition de l’espace de travail.',
    subsections: [
      {
        id: 'interface-toolbar',
        title: 'Bandeau supérieur',
        icon: 'mdi-dock-top',
        content:
          'La première rangée contient la recherche d’adresse, le menu Projets, l’aide et le menu ⋯. La seconde rangée rassemble les outils de dessin et le choix du fond de carte.',
        items: [
          {
            label: 'Point, Cercle, Ligne, Itinéraire, Polygone',
            text: 'Ouvrent leur formulaire de création.',
          },
          {
            label: 'Construire',
            text: 'Dépliez ce menu pour accéder à Azimut, Intersection, Parallèle, Main levée et Ligne avec angle.',
          },
          {
            label: 'Note et PDF',
            text: 'Créent une note ou importent/ouvrent le document PDF du projet.',
          },
          {
            label: 'Fond de carte',
            text: 'Le sélecteur à droite propose Geoportail (IGN), OpenStreetMap et les fonds Google Plan, Satellite et Relief.',
          },
          {
            label: 'Replier le bandeau',
            text: 'Utilisez la petite flèche sous le bandeau pour gagner de la place ; la flèche le rouvre.',
          },
        ],
      },
      {
        id: 'interface-more-menu',
        title: 'Menu ⋯ : thèmes, langue et GitHub',
        icon: 'mdi-dots-horizontal',
        content:
          'Le menu à trois points en haut à droite regroupe les réglages de l’espace de travail.',
        items: [
          {
            label: 'Thèmes',
            text: 'Ouvre les 14 palettes, dont Or & Velours et Orange mécanique. Le choix est mémorisé.',
          },
          {
            label: 'Langue',
            text: 'Ouvre le choix de la langue de l’application : français ou anglais.',
          },
          { label: 'GitHub', text: 'Ouvre le dépôt du projet dans un nouvel onglet.' },
        ],
      },
      {
        id: 'interface-sidebar',
        title: 'Carnet latéral et carte',
        icon: 'mdi-book-open-page-variant-outline',
        content:
          'Le bouton au milieu du bord gauche ouvre ou masque le carnet des éléments. Les boutons + et − en bas à droite règlent le zoom de la carte. Le bouton rond des outils, juste en dessous, ouvre la règle de mesure.',
      },
    ],
  },
  {
    id: 'assistant',
    title: '',
    icon: 'mdi-auto-fix',
    intro: '',
    subsections: ASSISTANT_PARTS.map(({ part, icon, items, content, badge }) => ({
      id: `assistant-${part}`,
      title: '',
      icon,
      // Its text comes from subsectionBadgeKeys.
      ...(badge ? { badge: 'advanced' } : {}),
      // Any non-empty value shows the paragraph; its text comes from the translations.
      ...(content ? { content: part } : {}),
      items: Array.from({ length: items }, () => ({ text: '' })),
    })),
  },
  {
    id: 'drawing',
    title: 'Outils de Dessin',
    icon: 'mdi-pencil',
    intro: 'Outils de tracé pour une précision géométrique sur la carte.',
    subsections: [
      {
        id: 'draw-access',
        title: 'Accès aux outils',
        icon: 'mdi-toolbox',
        content:
          'Dans le bandeau supérieur, les boutons Point, Cercle, Ligne, Itinéraire et Polygone ouvrent chacun un formulaire. Le menu Construire regroupe les autres outils de tracé.',
        items: [
          { text: 'Renseignez les paramètres, puis validez pour lancer ou enregistrer le dessin.' },
          {
            text: 'Pour une ligne, ouvrez Construire pour choisir Azimut, Intersection, Parallèle, Main levée ou Ligne avec angle.',
          },
          {
            text: 'La couleur et les propriétés des éléments existants se règlent depuis leur menu ⋮ dans le carnet.',
          },
        ],
      },
      {
        id: 'draw-itineraire',
        title: 'Itinéraire',
        icon: 'mdi-sign-direction',
        content:
          'Le bouton Itinéraire ouvre un formulaire qui calcule un trajet routier entre des points déjà enregistrés.',
        items: [
          { label: 'Nom', text: "Nom de l'itinéraire" },
          {
            label: 'Départ et arrivée',
            text: 'Choisissez les points enregistrés dans les listes.',
          },
          {
            label: 'Étapes',
            text: 'Ajoutez des points de passage, puis réordonnez-les ou retirez-les si besoin.',
          },
          {
            label: 'Profil et optimisation',
            text: 'Choisissez À pied ou En voiture, puis Le plus court ou Le plus rapide.',
          },
          {
            label: 'Calculer',
            text: 'L’itinéraire calculé apparaît ensuite dans le carnet avec les autres éléments.',
          },
        ],
      },
      {
        id: 'draw-circle',
        title: 'Cercle de Rayon',
        icon: 'mdi-circle-outline',
        content: "Cercle de portée exacte autour d'un centre.",
        items: [
          { label: 'Nom', text: 'Nom personnalisé du cercle' },
          { label: 'Centre', text: 'Sélectionnez un point enregistré ou saisie de coordonnées' },
          { label: 'Rayon', text: 'Saisie en kilomètres' },
        ],
      },
      {
        id: 'draw-line',
        title: 'Tracé de Lignes & Azimuts',
        icon: 'mdi-vector-line',
        badge: 'Essentiel',
        content: 'Modes de tracé disponibles :',
        items: [
          { label: 'Par deux points', text: "Sélection d'un point A puis d'un point B" },
          {
            label: 'Mode Azimut',
            text: 'Dans Construire → Azimut, indiquez un point de départ, un angle (0° à 360°) et une longueur.',
          },
          {
            label: 'Ligne avec angle',
            text: 'Sélectionnez un point de départ, puis une ligne de référence passant par ce point.',
          },
          {
            label: 'Intersection',
            text: 'Dans Construire → Intersection, choisissez un départ, un point d’intersection et la longueur au-delà du croisement ; vous pouvez aussi créer le point d’arrivée.',
          },
          {
            label: 'Parallèle',
            text: 'Choisissez un point enregistré pour définir la latitude de la ligne parallèle.',
          },
          {
            label: 'Main levée',
            text: 'Placez le départ puis déplacez le curseur et cliquez pour terminer. Maintenez Alt pour verrouiller l’azimut ou Ctrl pour verrouiller la distance.',
          },
          {
            label: 'Créer depuis deux points',
            text: 'Dans le carnet, faites glisser un point sur un autre pour relier les deux points.',
          },
        ],
      },
      {
        id: 'draw-intersection-edit',
        title: "Édition d'Intersection",
        icon: 'mdi-crosshairs-gps',
        badge: 'Avancé',
        content: "Ajustement du point d'intersection :",
        items: [
          {
            label: '1',
            text: "Activez la modification : Survolez l'extrémité de la ligne et cliquez sur la poignée bleue.",
          },
          {
            label: '2',
            text: "Ajustez la ligne : Déplacez la souris pour la prolonger ou la raccourcir. Le point de départ et l'intersection restent fixes.",
          },
          {
            label: '3',
            text: "Utilisez l'aimantage (optionnel) : L'extrémité peut s'accrocher à une autre ligne, un cercle ou un polygone proche (la poignée devient alors verte).",
          },
          {
            label: '4',
            text: 'Le panneau d’édition indique la distance au-delà du croisement. Cliquez de nouveau pour enregistrer et mettre à jour les éléments liés.',
          },
          {
            label: '5',
            text: 'Appuyez sur Échap ou choisissez Annuler pour restaurer la ligne d’origine.',
          },
        ],
      },
      {
        id: 'draw-crossing',
        title: 'Points de Croisement',
        icon: 'mdi-map-marker-distance',
        content:
          'En mode ligne libre, survolez le croisement intérieur de deux lignes visibles : un marqueur signale le point détecté. Cliquez dessus pour ouvrir le formulaire et créer un point à ces coordonnées.',
      },
      {
        id: 'draw-point',
        title: 'Points Isolés',
        icon: 'mdi-map-marker',
        content:
          'Le bouton Point du bandeau supérieur ouvre le formulaire. Vous pouvez aussi faire un clic droit sur la carte pour créer un point à cet endroit, puis lui donner un nom et vérifier ses coordonnées.',
      },
      {
        id: 'draw-polygon',
        title: 'Polygones',
        icon: 'mdi-vector-polygon',
        content: 'Zones fermées à plusieurs sommets.',
        items: [
          {
            label: 'Préparer les sommets',
            text: 'Créez d’abord les points qui délimitent la zone, puis choisissez-les dans le formulaire Polygone.',
          },
          {
            label: 'Calculs',
            text: 'Le carnet affiche le nombre de sommets, le périmètre et la surface.',
          },
          {
            label: 'Centre',
            text: 'Dans le menu ⋮ du polygone, choisissez Ajouter le centre comme point.',
          },
          {
            label: "Cas d'utilisation",
            text: "Définir des zones de recherche, marquer des zones d'intérêt ou visualiser des limites",
          },
        ],
      },
    ],
  },
  {
    id: 'search',
    title: 'Recherche & Exploration',
    icon: 'mdi-magnify',
    intro:
      'Recherchez une adresse depuis le champ situé au centre du bandeau supérieur, puis explorez les lieux à proximité de vos tracés.',
    subsections: [
      {
        id: 'search-address',
        title: "Recherche d'adresse",
        icon: 'mdi-map-search',
        items: [
          {
            label: '1',
            text: 'Saisissez une adresse, une ville ou un lieu-dit dans la barre de recherche au centre du bandeau supérieur.',
          },
          {
            label: '2',
            text: 'Choisissez un résultat dans la liste pour centrer la carte sur cet emplacement.',
          },
          {
            label: '3',
            text: 'Utilisez le lieu sélectionné pour créer un point ou un cercle depuis les outils du bandeau.',
          },
        ],
      },
      {
        id: 'search-path',
        title: "Rechercher près d'une ligne ou d'un itinéraire",
        icon: 'mdi-map-marker-path',
        badge: 'Analyse',
        items: [
          {
            label: '1',
            text: 'Dans le carnet, ouvrez le menu ⋮ d’une ligne, d’un itinéraire ou d’un point et choisissez Lieux à proximité.',
          },
          {
            label: '2',
            text: 'Réglez la distance pour afficher la zone de recherche autour de l’élément.',
          },
          {
            label: '3',
            text: 'Filtrez les résultats par catégorie, nom ou altitude lorsque ces données sont disponibles ; cliquez sur un résultat pour le repérer sur la carte.',
          },
        ],
      },
    ],
  },
  {
    id: 'navigation',
    title: 'Navigation Virtuelle',
    icon: 'mdi-navigation',
    intro: 'Suivez un cercle, une ligne ou un itinéraire sur la carte au clavier.',
    subsections: [
      {
        id: 'nav-howto',
        title: "Mode d'emploi",
        icon: 'mdi-compass-rose',
        items: [
          {
            label: '1',
            text: 'Dans le carnet, ouvrez le menu ⋮ d’un cercle, d’une ligne ou d’un itinéraire.',
          },
          {
            label: '2',
            text: 'Choisissez Naviguer : le bandeau supérieur affiche les consignes du mode.',
          },
          {
            label: '3',
            text: 'Utilisez les flèches gauche et droite pour avancer ou reculer le long du tracé ; Échap ou le bouton Quitter termine la navigation.',
          },
        ],
      },
    ],
  },
  {
    id: 'tools',
    title: 'Outils de Mesure',
    icon: 'mdi-tools',
    intro: 'La règle mesure sur la carte sans ajouter de dessin au projet.',
    subsections: [
      {
        id: 'tool-ruler',
        title: 'Règle de Mesure',
        icon: 'mdi-ruler',
        items: [
          {
            label: '1',
            text: 'Cliquez sur le bouton rond Outils en bas à droite, puis choisissez la règle dans la petite barre qui apparaît.',
          },
          {
            label: '2',
            text: 'Cliquez pour placer le départ, déplacez le curseur pour lire distance et azimut, puis cliquez de nouveau pour terminer. Échap annule la mesure ; aucun calque n’est créé.',
          },
        ],
      },
    ],
  },
  {
    id: 'layers',
    title: 'Gestion des Calques',
    icon: 'mdi-layers',
    intro: 'Le carnet à gauche réunit le projet courant, les éléments dessinés et leurs actions.',
    subsections: [
      {
        id: 'layers-actions',
        title: 'Retrouver et organiser les éléments',
        icon: 'mdi-format-list-bulleted',
        items: [
          {
            label: 'Catégories',
            text: 'Cercles, lignes, itinéraires, points, polygones et notes sont regroupés et peuvent être repliés.',
          },
          {
            label: 'Filtrer',
            text: 'Utilisez le champ Filtrer par nom pour retrouver un élément.',
          },
          {
            label: 'Visibilité',
            text: 'Le bouton œil d’une catégorie affiche ou masque tous ses éléments ; chaque menu ⋮ permet de basculer un élément seul.',
          },
          {
            label: 'Centrer',
            text: 'Cliquez sur le nom d’un élément pour centrer la carte dessus.',
          },
          {
            label: 'Réordonner',
            text: 'Faites glisser un élément dans sa catégorie pour modifier l’ordre de la liste.',
          },
          {
            label: 'Lier deux points',
            text: 'Faites glisser un point sur un autre point pour créer une ligne entre eux.',
          },
        ],
      },
      {
        id: 'layers-actions-2',
        title: 'Actions du menu ⋮',
        icon: 'mdi-format-list-bulleted',
        items: [
          {
            label: 'Afficher / Masquer',
            text: 'Change la visibilité de cet élément sur la carte.',
          },
          {
            label: 'Lieux à proximité',
            text: 'Disponible pour les lignes, itinéraires et points ; lance une recherche autour de cet élément.',
          },
          {
            label: 'Naviguer',
            text: 'Disponible pour les cercles, lignes et itinéraires ; lance le déplacement au clavier.',
          },
          {
            label: 'Ajouter un point sur',
            text: 'Pour une ligne, place un nouveau point à une distance définie depuis l’une de ses extrémités.',
          },
          {
            label: 'Relèvements',
            text: 'Pour un point, ouvre les distances et azimuts vers les autres points.',
          },
          {
            label: 'Ajouter une note',
            text: 'Ajoute ou modifie la note attachée à l’élément.',
          },
          {
            label: 'Modifier',
            text: 'Modifie les propriétés de l’élément ; le polygone se gère à partir de ses points.',
          },
          {
            label: 'Couleur',
            text: 'Pour les formes autres que les points, ouvre le sélecteur de couleur.',
          },
          { label: 'Ajouter le centre comme point', text: 'Action proposée pour les polygones.' },
          { label: 'Supprimer', text: 'Retire l’élément après confirmation.' },
        ],
      },
      {
        id: 'layers-groups',
        title: 'Créer et gérer des groupes',
        icon: 'mdi-folder-multiple-outline',
        content:
          'Rassemblez dans un groupe des éléments de types différents pour alléger le carnet.',
        items: [
          {
            label: '1',
            text: 'Cliquez sur le dossier + près du titre Calques, donnez un nom au groupe et sélectionnez les éléments.',
          },
          {
            label: '2',
            text: 'Vous pouvez regrouper des cercles, lignes, itinéraires, points, polygones et notes.',
          },
          { label: '3', text: 'Faites glisser un élément sur le groupe pour le ranger dedans.' },
          {
            label: '4',
            text: 'Utilisez le crayon pour modifier le nom ou la sélection ; l’œil affiche ou masque tous les éléments du groupe.',
          },
          {
            label: '5',
            text: 'Dans le menu ⋮ d’un élément, choisissez Sortir du groupe pour le remettre dans sa catégorie. Le bouton dossier − dissout le groupe sans supprimer ses éléments.',
          },
        ],
      },
      {
        id: 'layers-dragdrop',
        title: 'Importer et exporter',
        icon: 'mdi-file-upload-outline',
        content:
          'Le menu Projets du bandeau supérieur regroupe l’importation JSON, les exports JSON et GPX, ainsi que la gestion des projets.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'Notes & Remarques',
    icon: 'mdi-note-text',
    intro:
      'Ajoutez des notes autonomes depuis le bouton Note du bandeau supérieur, ou associez une note à un élément depuis son menu ⋮.',
    subsections: [
      {
        id: 'notes-add',
        title: 'Ajouter une Note',
        icon: 'mdi-note-plus-outline',
        items: [
          {
            label: '1',
            text: 'Pour une note liée, ouvrez le menu ⋮ de l’élément dans le carnet ou sur la carte, puis choisissez Ajouter une note.',
          },
          {
            label: '2',
            text: 'Pour une note libre, cliquez sur Note dans la rangée d’outils du bandeau supérieur.',
          },
          {
            label: '3',
            text: 'Saisissez un titre et un contenu ; une note liée reste associée à l’élément choisi.',
          },
          {
            label: '4',
            text: 'Dans le formulaire, choisissez le type de forme à lier puis sélectionnez l’élément proposé.',
          },
          {
            label: '5',
            text: 'Les notes liées apparaissent sous forme d’infobulles lorsque vous survolez leur élément sur la carte.',
          },
        ],
      },
    ],
  },
  {
    id: 'points',
    title: "Points d'Intérêt",
    icon: 'mdi-map-marker',
    intro:
      'Créez des repères géographiques, réutilisez-les dans vos tracés et retrouvez-les dans le carnet.',
    subsections: [
      {
        id: 'points-manage',
        title: 'Gestion',
        icon: 'mdi-map-marker-multiple',
        items: [
          {
            label: 'Créer',
            text: 'Cliquez sur Point dans le bandeau supérieur, ou faites un clic droit à l’emplacement voulu sur la carte.',
          },
          {
            label: 'Coordonnées',
            text: 'Saisissez latitude et longitude, ou choisissez un point enregistré dans les champs de coordonnées des formulaires.',
          },
          {
            label: 'Nom',
            text: 'Donnez un nom au point ; s’il est laissé vide, l’application peut proposer un nom à partir du lieu.',
          },
          {
            label: 'Gérer',
            text: 'Retrouvez les points dans leur catégorie du carnet : cliquez pour centrer la carte, utilisez ⋮ pour modifier, ajouter une note, ouvrir les relèvements ou supprimer.',
          },
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projets & Projections',
    icon: 'mdi-folder',
    intro:
      'Le menu Projets (bouton dossier) du bandeau supérieur permet de gérer le travail enregistré.',
    subsections: [
      {
        id: 'proj-system',
        title: 'Créer, ouvrir et sauvegarder un projet',
        icon: 'mdi-earth',
        content:
          'Les projets conservent automatiquement leurs éléments sur cet appareil. Le bouton Projets porte une icône de dossier.',
        items: [
          {
            label: 'Nouveau projet',
            text: 'Crée un espace de travail nommé ; choisissez sa projection à la création.',
          },
          {
            label: 'Charger un projet',
            text: 'Ouvre la liste des projets enregistrés pour basculer vers l’un d’eux.',
          },
          {
            label: 'Exporter JSON',
            text: 'Télécharge une sauvegarde de votre projet au format JSON.',
          },
          {
            label: 'Importer JSON',
            text: 'Charge un projet depuis un fichier de sauvegarde JSON.',
          },
          {
            label: 'Exporter GPX',
            text: 'Exporte les tracés du projet au format GPX pour les utiliser dans d’autres applications cartographiques.',
          },
          {
            label: 'Paramètres du projet',
            text: 'Ouvre le réglage de projection du projet courant.',
          },
          {
            label: 'Enregistrement',
            text: 'Les modifications sont sauvegardées automatiquement dans le navigateur. Exportez aussi un JSON pour disposer d’une copie de sauvegarde.',
          },
        ],
      },
      {
        id: 'proj-actions',
        title: 'Projection cartographique',
        icon: 'mdi-earth',
        content:
          'Choisissez la projection dans le formulaire de nouveau projet, ou ouvrez Projet → Paramètres du projet pour la modifier ensuite. Mercator garde droites les lignes du tracé sur la carte ; Géodésique (WGS84) suit les plus courts chemins sur la Terre et peut apparaître courbé. Le fond de carte se choisit séparément dans le sélecteur à droite du bandeau.',
        items: [
          {
            label: 'Portée',
            text: 'La projection agit sur la géométrie, les distances et les azimuts du projet.',
          },
          {
            label: 'Sauvegarde',
            text: 'Le réglage est conservé dans le projet et dans les exports JSON.',
          },
        ],
      },
    ],
  },
  {
    id: 'image-map',
    title: 'Fond de carte image',
    icon: 'mdi-image-outline',
    intro: '',
    subsections: [
      {
        id: 'image-map-import',
        title: '',
        icon: 'mdi-image-plus-outline',
        items: Array.from({ length: 3 }, () => ({ text: '' })),
      },
      {
        id: 'image-map-points',
        title: '',
        icon: 'mdi-crosshairs',
        items: Array.from({ length: 5 }, () => ({ text: '' })),
      },
      {
        id: 'image-map-ratio',
        title: '',
        icon: 'mdi-ruler',
        items: Array.from({ length: 3 }, () => ({ text: '' })),
      },
      {
        id: 'image-map-usage',
        title: '',
        icon: 'mdi-image-edit-outline',
        items: Array.from({ length: 5 }, () => ({ text: '' })),
      },
    ],
  },
  {
    id: 'pdf',
    title: 'Documents PDF',
    icon: 'mdi-file-pdf-box',
    intro:
      'Le bouton PDF du bandeau supérieur importe un document dans le projet courant ou ouvre son lecteur.',
    subsections: [
      {
        id: 'pdf-upload',
        title: 'Importer et lire un PDF',
        icon: 'mdi-file-document-outline',
        items: [
          {
            label: '1',
            text: 'Ouvrez ou créez un projet, puis cliquez sur PDF dans la seconde rangée du bandeau supérieur.',
          },
          {
            label: '2',
            text: 'Si le projet n’a pas encore de document, choisissez un fichier PDF (50 Mo maximum). Sinon, le lecteur s’ouvre.',
          },
          {
            label: '3',
            text: 'Dans le lecteur, changez de page, cliquez sur le numéro pour accéder à une page, réglez le zoom, ajustez à la largeur ou à la page, faites pivoter, affichez les miniatures ou téléchargez le document.',
          },
          {
            label: '4',
            text: 'Redimensionnez le panneau en faisant glisser son bord gauche. Pour un PDF protégé, saisissez son mot de passe lorsqu’il est demandé.',
          },
          {
            label: '4',
            text: "Le mot de passe est enregistré localement pour éviter de le ressaisir ; il n'est pas envoyé à un serveur.",
          },
          {
            label: 'Fonctionnalités',
            text: 'Chaque projet peut avoir son propre PDF. Le document est conservé dans le stockage du navigateur séparément des dessins.',
          },
          {
            label: 'Fonctionnalités',
            text: 'La corbeille du lecteur supprime le PDF du projet. Le PDF est conservé séparément et n’est pas inclus dans l’export JSON.',
          },
        ],
      },
    ],
  },
  {
    id: 'tips',
    title: 'Astuces & Raccourcis',
    icon: 'mdi-lightbulb',
    intro: 'Optimisation de votre flux de travail.',
    subsections: [
      {
        id: 'tips-shortcuts',
        title: 'Raccourcis Clavier',
        icon: 'mdi-keyboard',
        items: [
          { label: 'Ctrl/Cmd+Z', text: 'Annuler ou rétablir les modifications du projet' },
          { label: 'Échap', text: 'Annuler le tracé ou fermer la modale' },
          {
            label: 'Z',
            text: 'Activer ou quitter la loupe de précision ; Échap ou un clic droit la ferme également.',
          },
          {
            label: 'Clic Droit',
            text: 'Créer un point aux coordonnées cliquées sur la carte. Si la loupe est active, le clic droit la ferme.',
          },
          {
            label: 'Ctrl',
            text: 'Maintenez pendant le dessin main levée pour verrouiller la distance',
          },
          {
            label: 'Clic gauche sur une forme',
            text: 'Sélectionne l’élément dans le carnet et ouvre son menu d’actions à côté du pointeur.',
          },
          {
            label: 'Alt / Ctrl en main levée',
            text: 'Alt verrouille l’azimut et Ctrl verrouille la distance lorsque vous dessinez à main levée. Alt n’agit pas si un azimut a déjà été défini dans le formulaire.',
          },
        ],
      },
    ],
  },
];

const tutorialData = ref<Section[]>(DEFAULT_DATA);

const activeSection = computed(() => {
  return tutorialData.value.find((s) => s.id === activeTabId.value) || tutorialData.value[0];
});

const sectionTitleKeys: Record<string, string> = {
  'getting-started': 'tutorial.gettingStarted',
  interface: 'tutorial.interface',
  drawing: 'tutorial.drawingTools',
  search: 'tutorial.searchExplore',
  navigation: 'tutorial.navigation',
  tools: 'tutorial.tools',
  layers: 'tutorial.layers',
  notes: 'tutorial.notes',
  points: 'layers.points',
  projects: 'tutorial.projects',
  'image-map': 'tutorial.imageMapSection.title',
  assistant: 'tutorial.assistantSection.title',
  pdf: 'tutorial.pdf',
  tips: 'tutorial.tipsTricks',
};

const featureTitleKeys: Record<string, string> = {
  'feat-workspace': 'tutorial.guideContent.cards.workspace',
  'feat-interface': 'tutorial.guideContent.cards.interface',
  'feat-draw': 'tutorial.guideContent.cards.drawing',
  'feat-search': 'tutorial.guideContent.cards.search',
  'feat-path': 'tutorial.guideContent.cards.path',
  'feat-elevation': 'tutorial.guideContent.cards.elevation',
  'feat-points': 'tutorial.guideContent.cards.points',
  'feat-projects': 'tutorial.guideContent.cards.projects',
  'feat-assistant': 'tutorial.guideContent.cards.assistant',
};

const featureContentKeys: Record<string, string> = {
  'feat-workspace': 'tutorial.guideContent.cards.workspaceContent',
  'feat-interface': 'tutorial.guideContent.cards.interfaceContent',
  'feat-draw': 'tutorial.guideContent.cards.drawingContent',
  'feat-search': 'tutorial.guideContent.cards.searchContent',
  'feat-path': 'tutorial.guideContent.cards.pathContent',
  'feat-elevation': 'tutorial.guideContent.cards.elevationContent',
  'feat-points': 'tutorial.guideContent.cards.pointsContent',
  'feat-projects': 'tutorial.guideContent.cards.projectsContent',
  'feat-assistant': 'tutorial.guideContent.cards.assistantContent',
};

const subsectionTitleKeys: Record<string, string> = {
  ...assistantKeys((part) => assistantKey(part, 'title')),
  'image-map-import': 'tutorial.imageMapSection.import.title',
  'image-map-points': 'tutorial.imageMapSection.points.title',
  'image-map-ratio': 'tutorial.imageMapSection.ratio.title',
  'image-map-usage': 'tutorial.imageMapSection.usage.title',

  'interface-toolbar': 'tutorial.guideContent.interface.toolbar.title',
  'interface-more-menu': 'tutorial.guideContent.interface.moreMenu.title',
  'interface-sidebar': 'tutorial.guideContent.interface.sidebar.title',
  'draw-access': 'tutorial.drawingToolsSection.accessing.title',
  'draw-itineraire': 'tutorial.guideContent.drawing.itinerary.title',
  'draw-circle': 'tutorial.drawingToolsSection.circle.title',
  'draw-line': 'tutorial.drawingToolsSection.line.title',
  'draw-intersection-edit': 'tutorial.drawingToolsSection.intersectionEditing.title',
  'draw-crossing': 'tutorial.drawingToolsSection.crossingPoint.title',
  'draw-point': 'tutorial.drawingToolsSection.point.title',
  'draw-polygon': 'tutorial.drawingToolsSection.polygon.title',
  'search-address': 'tutorial.searchSection.addressSearch.title',
  'search-path': 'tutorial.guideContent.search.alongPath.title',
  'nav-howto': 'tutorial.navigationSection.howTo.title',
  'tool-ruler': 'tutorial.toolsSection.ruler.title',
  'layers-actions': 'tutorial.guideContent.layers.organize.title',
  'layers-actions-2': 'tutorial.layersSection.actions.title',
  'layers-groups': 'tutorial.guideContent.layers.groups.title',
  'layers-dragdrop': 'tutorial.guideContent.layers.importExport.title',
  'notes-add': 'tutorial.notesSection.howToAdd.title',
  'points-manage': 'tutorial.pointsSection.managing.title',
  'proj-system': 'tutorial.projectsSection.projectActions.title',
  'proj-actions': 'tutorial.projectsSection.projection.title',
  'pdf-upload': 'tutorial.pdfSection.uploading.title',
  'tips-shortcuts': 'tutorial.tipsSection.keyboardShortcuts.title',
};

const subsectionContentKeys: Record<string, string> = {
  ...assistantKeys((part) => assistantKey(part, 'content')),
  'interface-toolbar': 'tutorial.guideContent.interface.toolbar.content',
  'interface-more-menu': 'tutorial.guideContent.interface.moreMenu.content',
  'interface-sidebar': 'tutorial.guideContent.interface.sidebar.content',
  'draw-access': 'tutorial.drawingToolsSection.accessing.description',
  'draw-itineraire': 'tutorial.guideContent.drawing.itinerary.content',
  'draw-circle': 'tutorial.drawingToolsSection.circle.description',
  'draw-line': 'tutorial.drawingToolsSection.line.description',
  'draw-point': 'tutorial.drawingToolsSection.point.description',
  'draw-polygon': 'tutorial.drawingToolsSection.polygon.description',
  'search-address': 'tutorial.searchSection.addressSearch.description',
  'search-path': 'tutorial.searchSection.alongPath.description',
  'tool-ruler': 'tutorial.toolsSection.ruler.description',
  'layers-actions': 'tutorial.guideContent.layers.organize.content',
  'layers-groups': 'tutorial.guideContent.layers.groups.content',
  'layers-dragdrop': 'tutorial.guideContent.layers.importExport.content',
  'proj-system': 'tutorial.projectsSection.accessing.dropdown',
};

const subsectionItemKeys: Record<string, string[]> = {
  ...Object.fromEntries(
    ASSISTANT_PARTS.map(({ part, items }) => [
      `assistant-${part}`,
      Array.from({ length: items }, (_, index) => assistantKey(part, `item${index + 1}`)),
    ])
  ),
  'image-map-import': Array.from(
    { length: 3 },
    (_, index) => `tutorial.imageMapSection.import.item${index + 1}`
  ),
  'image-map-points': Array.from(
    { length: 5 },
    (_, index) => `tutorial.imageMapSection.points.item${index + 1}`
  ),
  'image-map-ratio': Array.from(
    { length: 3 },
    (_, index) => `tutorial.imageMapSection.ratio.item${index + 1}`
  ),
  'image-map-usage': Array.from(
    { length: 5 },
    (_, index) => `tutorial.imageMapSection.usage.item${index + 1}`
  ),

  'interface-toolbar': [
    'tutorial.guideContent.interface.toolbar.item1',
    'tutorial.guideContent.interface.toolbar.item2',
    'tutorial.guideContent.interface.toolbar.item3',
    'tutorial.guideContent.interface.toolbar.item4',
    'tutorial.guideContent.interface.toolbar.item5',
  ],
  'interface-more-menu': [
    'tutorial.guideContent.interface.moreMenu.item1',
    'tutorial.guideContent.interface.moreMenu.item2',
    'tutorial.guideContent.interface.moreMenu.item3',
  ],
  'interface-sidebar': ['tutorial.guideContent.interface.sidebar.item1'],
  'draw-access': [
    'tutorial.drawingToolsSection.accessing.clickButtons',
    'tutorial.drawingToolsSection.accessing.collapse',
    'tutorial.drawingToolsSection.accessing.toolsInclude',
  ],
  'draw-itineraire': [
    'tutorial.guideContent.drawing.itinerary.item1',
    'tutorial.guideContent.drawing.itinerary.item2',
    'tutorial.guideContent.drawing.itinerary.item3',
    'tutorial.guideContent.drawing.itinerary.item4',
    'tutorial.guideContent.drawing.itinerary.item5',
  ],
  'draw-circle': [
    'tutorial.drawingToolsSection.circle.name',
    'tutorial.drawingToolsSection.circle.center',
    'tutorial.drawingToolsSection.circle.radius',
  ],
  'draw-line': [
    'tutorial.drawingToolsSection.line.twoPoints',
    'tutorial.drawingToolsSection.line.azimuth',
    'tutorial.drawingToolsSection.line.angle',
    'tutorial.drawingToolsSection.line.intersection',
    'tutorial.drawingToolsSection.line.parallel',
    'tutorial.drawingToolsSection.line.freeHand',
    'tutorial.drawingToolsSection.line.dragDrop',
  ],
  'draw-intersection-edit': [
    'tutorial.drawingToolsSection.intersectionEditing.start',
    'tutorial.drawingToolsSection.intersectionEditing.move',
    'tutorial.drawingToolsSection.intersectionEditing.snap',
    'tutorial.drawingToolsSection.intersectionEditing.save',
    'tutorial.drawingToolsSection.intersectionEditing.cancel',
  ],
  'draw-polygon': [
    'tutorial.drawingToolsSection.polygon.selectPoints',
    'tutorial.drawingToolsSection.polygon.visual',
    'tutorial.drawingToolsSection.polygon.extractCenter',
    'tutorial.drawingToolsSection.polygon.useCase',
  ],
  'search-address': [
    'tutorial.guideContent.search.address.item1',
    'tutorial.guideContent.search.address.item2',
    'tutorial.guideContent.search.address.item3',
  ],
  'search-path': [
    'tutorial.guideContent.search.alongPath.item1',
    'tutorial.guideContent.search.alongPath.item2',
    'tutorial.guideContent.search.alongPath.item3',
  ],
  'nav-howto': [
    'tutorial.navigationSection.howTo.step1',
    'tutorial.navigationSection.howTo.step2',
    'tutorial.navigationSection.howTo.step3',
  ],
  'tool-ruler': [
    'tutorial.guideContent.tools.ruler.item1',
    'tutorial.guideContent.tools.ruler.item2',
  ],
  'layers-actions-2': [
    'tutorial.guideContent.layers.actions.item1',
    'tutorial.guideContent.layers.actions.item2',
    'tutorial.guideContent.layers.actions.item3',
    'tutorial.guideContent.layers.actions.item4',
    'tutorial.guideContent.layers.actions.item5',
    'tutorial.guideContent.layers.actions.item6',
    'tutorial.guideContent.layers.actions.item7',
    'tutorial.guideContent.layers.actions.item8',
    'tutorial.guideContent.layers.actions.item9',
    'tutorial.guideContent.layers.actions.item10',
  ],
  'layers-actions': [
    'tutorial.guideContent.layers.organize.item1',
    'tutorial.guideContent.layers.organize.item2',
    'tutorial.guideContent.layers.organize.item3',
    'tutorial.guideContent.layers.organize.item4',
    'tutorial.guideContent.layers.organize.item5',
    'tutorial.guideContent.layers.organize.item6',
  ],
  'layers-groups': [
    'tutorial.guideContent.layers.groups.item1',
    'tutorial.guideContent.layers.groups.item2',
    'tutorial.guideContent.layers.groups.item3',
    'tutorial.guideContent.layers.groups.item4',
    'tutorial.guideContent.layers.groups.item5',
  ],
  'layers-dragdrop': [],
  'notes-add': [
    'tutorial.guideContent.notes.add.item1',
    'tutorial.guideContent.notes.add.item2',
    'tutorial.guideContent.notes.add.item3',
    'tutorial.guideContent.notes.add.item4',
    'tutorial.guideContent.notes.add.item5',
  ],
  'points-manage': [
    'tutorial.guideContent.points.manage.item1',
    'tutorial.guideContent.points.manage.item2',
    'tutorial.guideContent.points.manage.item3',
    'tutorial.guideContent.points.manage.item4',
  ],
  'proj-system': [
    'tutorial.projectsSection.projectActions.newProject',
    'tutorial.projectsSection.projectActions.loadProject',
    'tutorial.projectsSection.projectActions.exportJSON',
    'tutorial.projectsSection.projectActions.importJSON',
    'tutorial.projectsSection.projectActions.exportGPX',
    'tutorial.projectsSection.projection.settings',
    'tutorial.projectsSection.features.autoSave',
  ],
  'proj-actions': [
    'tutorial.projectsSection.projection.choice',
    'tutorial.projectsSection.projection.export',
  ],
  'pdf-upload': [
    'tutorial.guideContent.pdf.item1',
    'tutorial.guideContent.pdf.item2',
    'tutorial.guideContent.pdf.item3',
    'tutorial.guideContent.pdf.item4',
    'tutorial.guideContent.pdf.item5',
    'tutorial.guideContent.pdf.item6',
    'tutorial.guideContent.pdf.item7',
  ],
  'tips-shortcuts': [
    'tutorial.tipsSection.keyboardShortcuts.history',
    'tutorial.tipsSection.keyboardShortcuts.esc',
    'tutorial.tipsSection.keyboardShortcuts.z',
    'tutorial.tipsSection.keyboardShortcuts.rightClick',
    'tutorial.tipsSection.keyboardShortcuts.ctrl',
    'tutorial.tipsSection.keyboardShortcuts.alt',
    'tutorial.tipsSection.keyboardShortcuts.arrows',
  ],
};

/** Bold label before an item: the example request, or the topic of a tip. */
const subsectionLabelKeys: Record<string, string[]> = Object.fromEntries(
  ASSISTANT_PARTS.map(({ part, items }) => [
    `assistant-${part}`,
    Array.from({ length: items }, (_, index) => assistantKey(part, `label${index + 1}`)),
  ])
);

const subsectionBadgeKeys: Record<string, string> = {
  'assistant-overlay': 'tutorial.guideContent.badges.advanced',
  'draw-line': 'tutorial.guideContent.badges.essential',
  'draw-intersection-edit': 'tutorial.guideContent.badges.advanced',
  'search-path': 'tutorial.guideContent.badges.analysis',
};

function sectionTitle(id: string): string {
  const key = sectionTitleKeys[id];
  return key ? String(t(key)) : '';
}

function featureTitle(id: string, fallback: string): string {
  const key = featureTitleKeys[id];
  return key ? String(t(key)) : fallback;
}

function featureContent(id: string, fallback: string): string {
  const key = featureContentKeys[id];
  return key ? String(t(key)) : fallback;
}

function subsectionBadge(id: string, fallback: string): string {
  const key = subsectionBadgeKeys[id];
  return key ? String(t(key)) : fallback;
}

function subsectionTitle(id: string, fallback: string): string {
  const key = subsectionTitleKeys[id];
  return key ? String(t(key)) : fallback;
}

function subsectionContent(subsection: Subsection): string {
  if (subsection.id === 'proj-actions') return String(t('tutorial.projectionHelp'));
  if (subsection.id === 'draw-crossing') {
    return `${t('tutorial.drawingToolsSection.crossingPoint.create')} ${t('tutorial.drawingToolsSection.crossingPoint.endpoints')}`;
  }
  if (subsection.id === 'draw-intersection-edit') {
    const prefix = 'tutorial.drawingToolsSection.intersectionEditing';
    return `${t(`${prefix}.start`)} ${t(`${prefix}.snap`)} ${t(`${prefix}.save`)} ${t(`${prefix}.cancel`)}`;
  }
  const key = subsectionContentKeys[subsection.id];
  if (key) return String(t(key));
  return subsection.content ?? '';
}

function detailLabel(subsection: Subsection, index: number, fallback?: string): string {
  const labelKey = subsectionLabelKeys[subsection.id]?.[index];
  if (labelKey && te(labelKey)) return String(t(labelKey));
  return subsectionItemKeys[subsection.id]?.[index] ? '' : (fallback ?? '');
}

function detailText(subsection: Subsection, index: number, fallback: string): string {
  const key = subsectionItemKeys[subsection.id]?.[index];
  return key ? String(t(key)) : fallback;
}

function sectionIntro(id: string, fallback: string): string {
  const keys: Record<string, string> = {
    'getting-started': 'tutorial.gettingStartedSection.intro',
    interface: 'tutorial.guideContent.intros.interface',
    drawing: 'tutorial.drawingToolsSection.intro',
    search: 'tutorial.searchSection.intro',
    navigation: 'tutorial.navigationSection.intro',
    tools: 'tutorial.toolsSection.intro',
    layers: 'tutorial.layersSection.intro',
    notes: 'tutorial.notesSection.intro',
    points: 'tutorial.pointsSection.intro',
    projects: 'tutorial.projectsSection.intro',
    'image-map': 'tutorial.imageMapSection.intro',
    assistant: 'tutorial.assistantSection.intro',
    pdf: 'tutorial.pdfSection.intro',
    tips: 'tutorial.guideContent.intros.tips',
  };
  const key = keys[id];
  return key ? String(t(key)) : fallback;
}

function navigateTo(targetId?: string) {
  if (targetId && tutorialData.value.some((s) => s.id === targetId)) {
    activeTabId.value = targetId;
  }
}

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
  width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  min-height: 100dvh;
  border-radius: 0 !important;
}

.tutorial-sidebar {
  min-height: 0;
}

.tutorial-step-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
}

.tutorial-step-heading h4 {
  min-width: 0;
  margin: 0;
}

.modern-feature-card .v-card-title {
  min-width: 0;
  white-space: normal;
}

.sidebar-header .v-card-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
}

.tutorial-tabs :deep(.v-tab) {
  justify-content: flex-start;
  min-height: 44px;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
}

.tutorial-tabs :deep(.v-tab--selected) {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}

.modern-kbd {
  background: rgba(var(--v-theme-on-surface), 0.06);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-bottom-width: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 600;
}

.tutorial-content-area {
  min-width: 0;
}

.tracking-tight {
  letter-spacing: -0.03em !important;
}
.max-width-700 {
  max-width: 700px;
}
.icon-wrapper {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
}
.border-dashed {
  border: 1px dashed rgba(var(--v-border-color), 0.4);
}

.modern-feature-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.modern-feature-card:hover,
.modern-feature-card:focus-visible {
  border-color: rgba(var(--v-theme-primary), 0.5);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1) !important;
  transform: translateY(-2px);
}

.tutorial-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tutorial-list li {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  font-size: 0.95rem;
  line-height: 1.5;
}
.text-pre-wrap {
  white-space: pre-wrap;
  line-height: 1.6;
}

@media (max-width: 700px) {
  .tutorial-card {
    flex-direction: column !important;
    min-height: 0;
  }
  .tutorial-sidebar {
    width: 100% !important;
    height: auto !important;
  }
  .sidebar-header {
    padding: 16px !important;
  }
  .tutorial-tabs {
    max-height: 132px;
    padding: 8px !important;
  }
  .tutorial-tabs :deep(.v-slide-group__content) {
    flex-direction: row;
  }
  .tutorial-tabs :deep(.v-tab) {
    flex: 0 0 auto;
    padding-inline: 12px;
  }
  .sidebar-footer {
    display: none !important;
  }
  .tutorial-content-area .v-container {
    padding: 20px !important;
  }
  .content-header {
    gap: 12px;
  }
  .content-header h3 {
    font-size: 1.75rem !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
