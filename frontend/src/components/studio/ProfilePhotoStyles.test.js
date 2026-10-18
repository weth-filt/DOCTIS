const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const selectorParser = require("postcss-selector-parser");

const LEGACY_FILES = ["dashboard.css", "dashboard-modern.css", "clinical-theme.css", "health-clarity.css", "health-studio.css"];
const readStyles = (files) => files.map((file) => postcss.parse(fs.readFileSync(path.resolve(__dirname, "../../CSS", file), "utf8"), { from: file }));
const legacyStyles = readStyles(LEGACY_FILES);
const currentStyles = [...legacyStyles, ...readStyles(["patient-redesign.css"])];
const compare = (a, b) => a.reduce((result, value, index) => result || value - b[index], 0);

function specificity(selector) {
  const score = [0, 0, 0];
  selector.each((node) => {
    if (node.type === "id") score[0] += 1;
    else if (node.type === "class" || node.type === "attribute") score[1] += 1;
    else if (node.type === "tag") score[2] += 1;
    else if (node.type === "pseudo") {
      if (node.value.startsWith("::")) score[2] += 1;
      else if (node.value === ":where") return;
      else if ([":is", ":not", ":has"].includes(node.value)) {
        const greatest = (node.nodes || []).map(specificity).sort(compare).pop() || [0, 0, 0];
        greatest.forEach((value, index) => { score[index] += value; });
      } else score[1] += 1;
    }
  });
  return score;
}

// This focused resolver models width media queries and author cascade, not
// browser geometry. Non-width feature queries and keyframes are excluded.
function mediaApplies(rule, width) {
  for (let parent = rule.parent; parent?.type !== "root"; parent = parent.parent) {
    if (parent.type !== "atrule") continue;
    if (parent.name !== "media") return false;
    const matches = postcss.list.comma(parent.params).some((query) => {
      const limits = [...query.matchAll(/\((min|max)-width\s*:\s*([\d.]+)px\)/g)];
      const unsupported = query.replace(/\((min|max)-width\s*:\s*([\d.]+)px\)/g, "").replace(/\b(?:and|screen|all)\b/g, "").trim();
      return !unsupported && limits.every(([, kind, value]) => kind === "min" ? width >= Number(value) : width <= Number(value));
    });
    if (!matches) return false;
  }
  return true;
}

function effectiveStyles(element, width, sheets) {
  const winners = {};
  let order = 0;
  sheets.forEach((sheet) => sheet.walkRules((rule) => {
    if (!mediaApplies(rule, width)) return;
    const selectors = selectorParser().astSync(rule.selector).nodes;
    const matched = selectors.filter((selector) => {
      try { return element.matches(selector.toString()); } catch { return false; }
    });
    if (!matched.length) return;
    const score = matched.map(specificity).sort(compare).pop();
    rule.walkDecls((declaration) => {
      const rank = [declaration.important ? 1 : 0, ...score, ++order];
      if (!winners[declaration.prop] || compare(rank, winners[declaration.prop].rank) >= 0) {
        winners[declaration.prop] = { value: declaration.value, rank, file: sheet.source.input.file };
      }
    });
  }));
  return winners;
}

beforeEach(() => {
  document.body.innerHTML = '<div class="dashboard-layout health-studio-layout doctis-v5" data-studio-theme="light"><div class="studio-profile-page"><div class="studio-profile-card"><div class="profile-page-header">Profile</div><div class="profile-photo-section"><div class="patient-photo-box"><img alt="Portrait" /></div><input type="file" style="display:none" /><p class="photo-note">Photo 4x6 / JPG, PNG / 5MB</p></div></div></div></div>';
});
afterEach(() => { document.body.innerHTML = ""; });

test("the legacy cascade reproduces the portrait/caption horizontal collision", () => {
  const section = effectiveStyles(document.querySelector(".profile-photo-section"), 1280, legacyStyles);
  const portrait = effectiveStyles(document.querySelector(".patient-photo-box"), 1280, legacyStyles);
  expect(section.display.value).toBe("flex");
  expect(section["flex-direction"].value).toBe("row");
  expect(portrait.width.value).toBe("104px");
});

test.each([[1280, "90px", "128px"], [390, "66px", "96px"]])("the fixed portrait stacks its caption below at %ipx", (viewport, width, height) => {
  const section = effectiveStyles(document.querySelector(".profile-photo-section"), viewport, currentStyles);
  const portrait = effectiveStyles(document.querySelector(".patient-photo-box"), viewport, currentStyles);
  const caption = effectiveStyles(document.querySelector(".photo-note"), viewport, currentStyles);
  expect(section.display.value).toBe("grid");
  expect(section["grid-template-columns"].value.replace(/\s/g, "")).toBe("minmax(0,1fr)");
  expect(section["grid-auto-flow"].value).toBe("row");
  expect(portrait.width.value).toBe(width);
  expect(portrait.height.value).toBe(height);
  expect(caption["grid-column"].value).toBe("1");
  expect(caption["grid-row"].value).toBe("2");
  expect(caption.width.value).toBe("100%");
  expect(caption["text-align"].value).toBe("center");
  expect(caption["word-break"].value).toBe("normal");
  expect(path.basename(section.display.file)).toBe("patient-redesign.css");
  expect(path.basename(portrait.width.file)).toBe("patient-redesign.css");
});
