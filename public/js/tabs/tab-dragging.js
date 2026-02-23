let dragState = {
  isDragging: false,
  draggedTab: null,
  draggedTabId: null,
  startX: 0,
  currentX: 0,
  originalIndex: -1,
  currentIndex: -1,
  tabs: [],
  originalRects: []
};

function handleTabMouseDown(e) {
  if (e.target.closest('.tab-close')) return;

  const tab = e.target.closest('.tab');
  if (!tab) return;

  const tabId = tab.getAttribute('data-tab-id');
  const activeTabId = window.activeTabId || 'newtab';

  if (tabId !== activeTabId) {
    window.setActiveTab(tabId);
  }

  dragState.isDragging = false;
  dragState.draggedTab = tab;
  dragState.draggedTabId = tabId;
  dragState.startX = e.clientX;
  dragState.currentX = e.clientX;

  const tabsContainer = document.querySelector(".tabs");
  dragState.tabs = Array.from(tabsContainer.querySelectorAll(".tab"));
  dragState.originalIndex = dragState.tabs.indexOf(tab);
  dragState.currentIndex = dragState.originalIndex;

  document.addEventListener("mousemove", handleTabMouseMove);
  document.addEventListener("mouseup", handleTabMouseUp);

  e.preventDefault();
}

function handleTabMouseMove(e) {
  if (!dragState.draggedTab) return;

  dragState.currentX = e.clientX;
  const deltaX = dragState.currentX - dragState.startX;

  if (!dragState.isDragging && Math.abs(deltaX) > 5) {
    dragState.isDragging = true;
    dragState.draggedTab.classList.add('dragging');
    dragState.draggedTab.style.zIndex = '1000';
    document.body.classList.add('dragging');

    const tabsContainer = document.querySelector('.tabs');
    dragState.originalRects = dragState.tabs.map(tab => {
      const rect = tab.getBoundingClientRect();
      return {
        left: rect.left,
        width: rect.width,
        center: rect.left + rect.width / 2
      };
    });
  }

  if (!dragState.isDragging) return;

  const draggedOriginalCenter = dragState.originalRects[dragState.originalIndex].center;
  const draggedCurrentCenter = draggedOriginalCenter + deltaX;

  let newIndex = dragState.currentIndex;

  const tabsContainer = document.querySelector('.tabs');
  const newTabButton = document.querySelector('.add-tab');
  const newTabButtonRect = newTabButton ? newTabButton.getBoundingClientRect() : null;
  const newTabButtonLeft = newTabButtonRect ? newTabButtonRect.left : Infinity;

  const tabPositions = dragState.tabs.map((tab, index) => {
    if (index === dragState.originalIndex) {
      return { index, center: draggedCurrentCenter, isDragged: true };
    }

    let tabCurrentCenter = dragState.originalRects[index].center;
    const currentTransform = tab.style.transform;
    if (currentTransform) {
      const match = currentTransform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
      if (match) tabCurrentCenter += parseFloat(match[1]);
    }

    return { index, center: tabCurrentCenter, isDragged: false };
  });

  tabPositions.sort((a, b) => a.center - b.center);

  const draggedPos = tabPositions.find(p => p.isDragged);
  if (draggedPos) {
    newIndex = tabPositions.indexOf(draggedPos);
  }

  const draggedTabRect = dragState.originalRects[dragState.originalIndex];
  const draggedTabRightEdge = draggedTabRect.left + draggedTabRect.width + deltaX;

  if (newTabButtonRect && draggedTabRightEdge >= newTabButtonLeft) {
    newIndex = dragState.tabs.length - 1;
  }

  if (newIndex !== dragState.currentIndex) {
    const draggedWidth = dragState.originalRects[dragState.originalIndex].width;

    dragState.tabs.forEach(tab => {
      if (tab !== dragState.draggedTab) {
        tab.style.transform = "";
      }
    });

    dragState.tabs.forEach((tab, index) => {
      if (tab === dragState.draggedTab) return;

      let offset = 0;
      if (dragState.originalIndex < newIndex) {
        if (index > dragState.originalIndex && index <= newIndex) {
          offset = -draggedWidth;
        }
      } else if (dragState.originalIndex > newIndex) {
        if (index >= newIndex && index < dragState.originalIndex) {
          offset = draggedWidth;
        }
      }

      if (offset !== 0) {
        tab.style.transform = `translateX(${offset}px)`;
        tab.style.transition = 'transform 0.2s ease';
      }
    });

    dragState.currentIndex = newIndex;
  }

  let finalDeltaX = deltaX;
  if (newTabButtonRect) {
    const draggedTabRect = dragState.originalRects[dragState.originalIndex];
    const draggedTabRightEdge = draggedTabRect.left + draggedTabRect.width + deltaX;

    if (draggedTabRightEdge >= newTabButtonLeft) {
      const maxDeltaX = newTabButtonLeft - (draggedTabRect.left + draggedTabRect.width) - 5;
      finalDeltaX = Math.min(deltaX, maxDeltaX);
    }
  }

  const isActive = dragState.draggedTab.classList.contains('active');
  if (isActive) {
    dragState.draggedTab.style.transform = `translateX(${finalDeltaX}px) translateY(1px)`;
  } else {
    dragState.draggedTab.style.transform = `translateX(${finalDeltaX}px)`;
  }
  dragState.draggedTab.style.transition = 'none';
}

function handleTabMouseUp(e) {
  if (!dragState.draggedTab) {
    document.removeEventListener('mousemove', handleTabMouseMove);
    document.removeEventListener('mouseup', handleTabMouseUp);
    return;
  }

  const wasDragging = dragState.isDragging;
  const draggedTab = dragState.draggedTab;
  const tabsToAnimate = [...dragState.tabs];
  const originalIndex = dragState.originalIndex;
  const newIndex = dragState.currentIndex;

  if (wasDragging) {
    const tabsContainer = document.querySelector('.tabs');
    const newTabButton = document.querySelector('.add-tab');
    const isActive = draggedTab.classList.contains('active');

    draggedTab.classList.remove('dragging');
    draggedTab.style.zIndex = '';

    if (newIndex !== originalIndex) {
      const currentPositions = new Map();
      tabsToAnimate.forEach(tab => {
        const rect = tab.getBoundingClientRect();
        currentPositions.set(tab, rect.left);
      });

      const allTabs = Array.from(tabsContainer.querySelectorAll('.tab'));
      const tabsWithoutDragged = allTabs.filter(t => t !== draggedTab);

      if (newIndex >= tabsWithoutDragged.length) {
        tabsContainer.insertBefore(draggedTab, newTabButton);
      } else {
        const targetTab = tabsWithoutDragged[newIndex];
        tabsContainer.insertBefore(draggedTab, targetTab);
      }

      window.updateTabDividers();

      tabsToAnimate.forEach(tab => {
        tab.style.transition = 'none';
        tab.style.willChange = 'transform';
      });

      requestAnimationFrame(() => {
        tabsToAnimate.forEach(tab => {
          tab.style.transform = '';
        });

        const finalPositions = new Map();
        tabsToAnimate.forEach(tab => {
          const rect = tab.getBoundingClientRect();
          finalPositions.set(tab, rect.left);
        });

        tabsToAnimate.forEach(tab => {
          const currentPos = currentPositions.get(tab);
          const finalPos = finalPositions.get(tab);

          if (currentPos !== undefined && finalPos !== undefined) {
            const offset = currentPos - finalPos;
            if (Math.abs(offset) > 0.5) {
              if (tab.classList.contains('active')) {
                tab.style.transform = `translateX(${offset}px) translateY(1px)`;
              } else {
                tab.style.transform = `translateX(${offset}px)`;
              }
            }
          }
        });

        requestAnimationFrame(() => {
          tabsToAnimate.forEach(tab => {
            tab.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            if (tab.classList.contains('active')) {
              tab.style.transform = 'translateY(1px)';
            } else {
              tab.style.transform = '';
            }
          });

          setTimeout(() => {
            tabsToAnimate.forEach(tab => {
              tab.style.transition = '';
              tab.style.willChange = '';
            });
            document.body.classList.remove('dragging');
            window.updateTabDividers();
            window.saveTabsToStorage();
          }, 250);
        });
      });
    } else {
      const tabsWithTransforms = [];
      tabsToAnimate.forEach(tab => {
        if (tab !== draggedTab) {
          const tabTransform = tab.style.transform;
          const tabMatch = tabTransform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
          if (tabMatch) {
            tabsWithTransforms.push({
              tab: tab,
              translateX: parseFloat(tabMatch[1])
            });
          }
        }
      });

      draggedTab.style.transition = 'transform 0.2s ease';
      tabsWithTransforms.forEach(({ tab }) => {
        tab.style.transition = 'transform 0.2s ease';
      });

      if (isActive) {
        draggedTab.style.transform = 'translateY(1px)';
      } else {
        draggedTab.style.transform = '';
      }

      tabsWithTransforms.forEach(({ tab }) => {
        if (tab.classList.contains('active')) {
          tab.style.transform = 'translateY(1px)';
        } else {
          tab.style.transform = '';
        }
      });

      setTimeout(() => {
        draggedTab.style.transition = '';
        tabsWithTransforms.forEach(({ tab }) => {
          tab.style.transition = '';
        });
        document.body.classList.remove('dragging');
        window.updateTabDividers();
      }, 200);
    }
  } else {
    document.body.classList.remove('dragging');
  }
  dragState = {
    isDragging: false,
    draggedTab: null,
    draggedTabId: null,
    startX: 0,
    currentX: 0,
    originalIndex: -1,
    currentIndex: -1,
    tabs: [],
    originalRects: []
  };

  document.removeEventListener('mousemove', handleTabMouseMove);
  document.removeEventListener('mouseup', handleTabMouseUp);
}

window.handleTabMouseDown = handleTabMouseDown;
