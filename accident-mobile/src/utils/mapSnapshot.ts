export type SnapshotRow = {
  color: string;
  text: string;
  weight?: number;
};

export type HighRiskMarker = {
  no: number;
  latitude: number;
  longitude: number;
  color: string;
};

export type SnapshotPoint = {
  no: number;
  color: string;
  text: string;
};

export type SnapshotInfo = {
  title: string;
  subtitle?: string;
  rows: SnapshotRow[];
  pointsTitle?: string;
  points?: SnapshotPoint[];
  notes: string[];
  footnotes?: string[];
};

export type AppMapHandle = {
  captureImage: (info: SnapshotInfo) => Promise<string>;
};

export const MAP_CAPTURE_SOURCE = `function (map, tileLayer, data, done) {
  var L = window.L;
  var prevCenter = map.getCenter();
  var prevZoom = map.getZoom();
  var finished = false;
  var box = map.getContainer();
  var oldBoxW = box.style.width;
  var oldBoxH = box.style.height;

  var finish = function (err, url) {
    if (finished) { return; }
    finished = true;
    try {
      box.style.width = oldBoxW;
      box.style.height = oldBoxH;
      map.invalidateSize({ animate: false });
    } catch (e) {}
    try { map.setView(prevCenter, prevZoom, { animate: false }); } catch (e) {}
    done(err, url);
  };

  var render = function () {
    var container = map.getContainer();
    var cRect = container.getBoundingClientRect();
    var w = Math.round(cRect.width);
    var h = Math.round(cRect.height);
    var info = data.info || {};
    var rows = info.rows || [];
    var notes = info.notes || [];
    var points = info.points || [];
    var footnotes = info.footnotes || [];
    var pad = 14;
    var maxW = w - pad * 2;

    var measure = document.createElement('canvas').getContext('2d');
    var wrap = function (text, font, maxWidth, maxLines) {
      measure.font = font;
      text = String(text || '');
      var lines = [];
      var cur = '';
      var k;
      for (k = 0; k < text.length; k++) {
        var t = cur + text.charAt(k);
        if (measure.measureText(t).width > maxWidth && cur.length > 0) {

          var alnum = /[0-9A-Za-z]/;
          var cut = cur.length;
          if (alnum.test(cur.charAt(cur.length - 1)) && alnum.test(text.charAt(k))) {
            var back = cur.length - 1;
            while (back > 0 && alnum.test(cur.charAt(back - 1))) { back--; }
            if (back > 0) { cut = back; }
          }
          lines.push(cur.slice(0, cut));
          cur = cur.slice(cut) + text.charAt(k);
        } else {
          cur = t;
        }
      }
      if (cur.length > 0) { lines.push(cur); }
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        var last = lines[maxLines - 1];
        while (last.length > 1 && measure.measureText(last + '...').width > maxWidth) {
          last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + '...';
      }
      return lines;
    };

    var F_TITLE = 'bold 15px sans-serif';
    var F_SUB = '12px sans-serif';
    var F_ROW = '13px sans-serif';
    var F_HEAD = 'bold 13px sans-serif';
    var F_PT = '12px sans-serif';
    var F_NOTE = '12px sans-serif';
    var F_FOOT = '11px sans-serif';

    var blocks = [];
    var stripH = 0;
    if (info.title) {
      blocks.push({ h: 16, draw: null });

      var titleLines = wrap(info.title, F_TITLE, maxW, 2);
      blocks.push({
        h: titleLines.length * 20 + 2,
        draw: function (y) {
          ctx.font = F_TITLE;
          ctx.fillStyle = '#111827';
          for (var q = 0; q < titleLines.length; q++) { ctx.fillText(titleLines[q], pad, y + q * 20); }
        }
      });

      if (info.subtitle) {
        var subLines = wrap(info.subtitle, F_SUB, maxW, 2);
        blocks.push({
          h: subLines.length * 17 + 4,
          draw: function (y) {
            ctx.font = F_SUB;
            ctx.fillStyle = '#6b7280';
            for (var q = 0; q < subLines.length; q++) { ctx.fillText(subLines[q], pad, y + q * 17); }
          }
        });
      }

      blocks.push({ h: 6, draw: null });

      var barMode = rows.length > 0 && rows.every(function (r) { return typeof r.weight === 'number'; });

      if (barMode) {
        var totalW = 0;
        rows.forEach(function (r) { totalW += r.weight; });

        blocks.push({
          h: 22,
          draw: function (y) {
            var minW = 3;
            var widths = rows.map(function (r) {
              return r.weight > 0 ? Math.max(minW, (r.weight / totalW) * maxW) : 0;
            });
            var sum = 0;
            widths.forEach(function (x) { sum += x; });
            var f = sum > 0 ? maxW / sum : 1;
            var x0 = pad;
            for (var q = 0; q < rows.length; q++) {
              var ww = widths[q] * f;
              if (ww <= 0) { continue; }
              ctx.fillStyle = rows[q].color || '#9CA3AF';
              ctx.fillRect(x0, y, ww, 14);
              x0 += ww;
            }
          }
        });

        measure.font = F_PT;
        var legendLines = [[]];
        var lineW = 0;
        rows.forEach(function (r) {
          var iw = 14 + measure.measureText(r.text).width + 14;
          if (lineW + iw > maxW && legendLines[legendLines.length - 1].length > 0) {
            legendLines.push([]);
            lineW = 0;
          }
          legendLines[legendLines.length - 1].push({ r: r, w: iw });
          lineW += iw;
        });
        legendLines.forEach(function (ln) {
          blocks.push({
            h: 20,
            draw: function (y) {
              var lx = pad;
              ln.forEach(function (it) {
                ctx.fillStyle = it.r.color || '#9CA3AF';
                ctx.fillRect(lx, y + 2, 10, 10);
                ctx.font = F_PT;
                ctx.fillStyle = '#1f2937';
                ctx.fillText(it.r.text, lx + 14, y);
                lx += it.w;
              });
            }
          });
        });
      } else {
        rows.forEach(function (row) {
          var rl = wrap(row.text, F_ROW, maxW - 22, 1);
          blocks.push({
            h: 22,
            draw: function (y) {
              ctx.fillStyle = row.color || '#9CA3AF';
              ctx.fillRect(pad, y + 2, 14, 14);
              ctx.font = F_ROW;
              ctx.fillStyle = '#1f2937';
              ctx.fillText(rl[0] || '', pad + 22, y);
            }
          });
        });
      }

      if (points.length > 0) {
        blocks.push({ h: 8, draw: null });
        blocks.push({ h: 1, draw: function (y) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(pad, y, maxW, 1); } });
        blocks.push({ h: 8, draw: null });
        blocks.push({
          h: 24,
          draw: function (y) {
            ctx.font = F_HEAD;
            ctx.fillStyle = '#111827';
            ctx.fillText(info.pointsTitle || 'จุดเสี่ยงสูงบนเส้นทาง', pad, y);
          }
        });
        points.forEach(function (pt) {
          var pl = wrap(pt.text, F_PT, maxW - 30, 1);
          blocks.push({
            h: pl.length * 17 + 6,
            draw: function (y) {
              ctx.beginPath();
              ctx.arc(pad + 10, y + 8, 10, 0, Math.PI * 2);
              ctx.fillStyle = pt.color || '#C62828';
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(String(pt.no), pad + 10, y + 2);
              ctx.textAlign = 'left';
              ctx.font = F_PT;
              ctx.fillStyle = '#1f2937';
              for (var q = 0; q < pl.length; q++) { ctx.fillText(pl[q], pad + 30, y + 1 + q * 17); }
            }
          });
        });
      }

      if (notes.length > 0) { blocks.push({ h: 4, draw: null }); }
      notes.forEach(function (note) {
        var nl = wrap(note, F_NOTE, maxW, 2);
        blocks.push({
          h: nl.length * 17 + 4,
          draw: function (y) {
            ctx.font = F_NOTE;
            ctx.fillStyle = '#4b5563';
            for (var q = 0; q < nl.length; q++) { ctx.fillText(nl[q], pad, y + q * 17); }
          }
        });
      });

      if (footnotes.length > 0) { blocks.push({ h: 6, draw: null }); }
      footnotes.forEach(function (fn) {
        var fl = wrap(fn, F_FOOT, maxW, 3);
        blocks.push({
          h: fl.length * 15 + 3,
          draw: function (y) {
            ctx.font = F_FOOT;
            ctx.fillStyle = '#9ca3af';
            for (var q = 0; q < fl.length; q++) { ctx.fillText(fl[q], pad, y + q * 15); }
          }
        });
      });

      blocks.push({ h: 8, draw: null });
      blocks.push({
        h: 18,
        draw: function (y) {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#9ca3af';
          ctx.fillText('SafeRoute', pad, y);
        }
      });
      blocks.push({ h: 12, draw: null });

      blocks.forEach(function (bk) { stripH += bk.h; });
    }

    var scale = Math.min(window.devicePixelRatio || 1, 2);
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round((h + stripH) * scale);
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, w, h + stripH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    var i;
    var j;

    var levels = [];
    var tileContainers = tileLayer.getContainer().querySelectorAll('.leaflet-tile-container');
    for (i = 0; i < tileContainers.length; i++) {
      var z = parseInt(tileContainers[i].style.zIndex, 10);
      levels.push({ z: isNaN(z) ? 0 : z, el: tileContainers[i] });
    }
    levels.sort(function (a, b) { return a.z - b.z; });
    for (i = 0; i < levels.length; i++) {
      var imgs = levels[i].el.querySelectorAll('img');
      for (j = 0; j < imgs.length; j++) {
        var im = imgs[j];
        if (!im.complete || !im.naturalWidth) { continue; }
        var r = im.getBoundingClientRect();
        ctx.drawImage(im, r.left - cRect.left, r.top - cRect.top, r.width + 0.5, r.height + 0.5);
      }
    }

    var route = data.route || [];
    var colors = data.colors || [];
    var pts = [];
    for (i = 0; i < route.length; i++) {
      pts.push(map.latLngToContainerPoint(route[i]));
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length > 1) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (i = 1; i < pts.length; i++) { ctx.lineTo(pts[i].x, pts[i].y); }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 6;
      for (i = 0; i < pts.length - 1; i++) {
        ctx.strokeStyle = colors[i] || '#1976D2';
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }
    }

    var dot = function (latlng, color) {
      if (!latlng) { return; }
      var p = map.latLngToContainerPoint(latlng);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    };
    dot(data.origin, '#1976D2');
    dot(data.dest, '#E53935');

    var marks = data.marks || [];
    var ops = [];
    var near = [];
    for (i = 0; i < marks.length; i++) {
      ops.push(map.latLngToContainerPoint([marks[i][0], marks[i][1]]));
      near.push(false);
    }
    for (i = 0; i < marks.length; i++) {
      for (j = 0; j < marks.length; j++) {
        if (i !== j) {
          var ddx = ops[i].x - ops[j].x;
          var ddy = ops[i].y - ops[j].y;
          if (ddx * ddx + ddy * ddy < 38 * 38) { near[i] = true; }
        }
      }
    }

    var badge = [];
    for (i = 0; i < marks.length; i++) { badge.push({ x: ops[i].x, y: ops[i].y }); }

    var comp = [];
    for (i = 0; i < marks.length; i++) { comp.push(-1); }
    var nComp = 0;
    for (i = 0; i < marks.length; i++) {
      if (comp[i] !== -1 || !near[i]) { continue; }
      var stack = [i];
      comp[i] = nComp;
      while (stack.length > 0) {
        var cur = stack.pop();
        for (j = 0; j < marks.length; j++) {
          if (comp[j] === -1 && near[j]) {
            var ex = ops[cur].x - ops[j].x;
            var ey = ops[cur].y - ops[j].y;
            if (ex * ex + ey * ey < 38 * 38) { comp[j] = nComp; stack.push(j); }
          }
        }
      }
      nComp++;
    }

    var c;
    for (c = 0; c < nComp; c++) {
      var mem = [];
      for (i = 0; i < marks.length; i++) { if (comp[i] === c) { mem.push(i); } }
      if (mem.length < 2) { continue; }
      mem.sort(function (p, q) { return marks[p][2] - marks[q][2]; });

      var cx0 = 0;
      var cy0 = 0;
      for (i = 0; i < mem.length; i++) { cx0 += ops[mem[i]].x; cy0 += ops[mem[i]].y; }
      cx0 = cx0 / mem.length;
      cy0 = cy0 / mem.length;

      var best = 0;
      var bestD = 1e18;
      for (i = 0; i < pts.length; i++) {
        var qx = pts[i].x - cx0;
        var qy = pts[i].y - cy0;
        if (qx * qx + qy * qy < bestD) { bestD = qx * qx + qy * qy; best = i; }
      }
      var i0 = Math.max(0, best - 25);
      var i1 = Math.min(pts.length - 1, best + 25);
      var tx = 1;
      var ty = 0;
      if (pts.length > 1 && i1 > i0) {
        tx = pts[i1].x - pts[i0].x;
        ty = pts[i1].y - pts[i0].y;
        var tl = Math.sqrt(tx * tx + ty * ty);
        if (tl > 0) { tx = tx / tl; ty = ty / tl; } else { tx = 1; ty = 0; }
      }

      var gap = 42;
      var offs = 78;
      var sign;
      var chosen = null;
      for (sign = -1; sign <= 1 && !chosen; sign += 2) {
        var nx = -ty * sign;
        var ny = tx * sign;
        var okAll = true;
        var tmp = [];
        for (i = 0; i < mem.length; i++) {
          var kk = i - (mem.length - 1) / 2;
          var bx = cx0 + nx * offs + tx * kk * gap;
          var by = cy0 + ny * offs + ty * kk * gap;
          if (bx < 26 || bx > w - 26 || by < 26 || by > h - 26) { okAll = false; }
          tmp.push({ x: bx, y: by });
        }
        if (okAll) { chosen = tmp; }
      }
      if (!chosen) {
        chosen = [];
        for (i = 0; i < mem.length; i++) {
          var k2 = i - (mem.length - 1) / 2;
          chosen.push({
            x: Math.min(Math.max(cx0 - ty * offs + tx * k2 * gap, 26), w - 26),
            y: Math.min(Math.max(cy0 + tx * offs + ty * k2 * gap, 26), h - 26)
          });
        }
      }
      for (i = 0; i < mem.length; i++) { badge[mem[i]] = chosen[i]; }
    }

    for (i = 0; i < marks.length; i++) {
      if (near[i]) {
        ctx.beginPath();
        ctx.moveTo(ops[i].x, ops[i].y);
        ctx.lineTo(badge[i].x, badge[i].y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#374151';
        ctx.stroke();
      }
    }
    for (i = 0; i < marks.length; i++) {
      if (near[i]) {
        ctx.beginPath();
        ctx.arc(ops[i].x, ops[i].y, 6, 0, Math.PI * 2);
        ctx.fillStyle = marks[i][3] || '#C62828';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
    for (i = 0; i < marks.length; i++) {
      var mk = marks[i];
      var mp = badge[i];

      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 19, 0, Math.PI * 2);
      ctx.fillStyle = mk[3] || '#C62828';
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = mk[3] || '#C62828';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(mk[2]), mp.x, mp.y + 1);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.restore();

    if (stripH > 0) {
      var y0 = h;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y0, w, stripH);
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(0, y0, w, 1);
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      var yy = y0;
      blocks.forEach(function (bk) {
        if (bk.draw) { bk.draw(yy); }
        yy += bk.h;
      });
    }

    return canvas.toDataURL('image/jpeg', 0.92);
  };

  var draw = function () {
    var url;
    try {
      url = render();
    } catch (e) {
      finish(String(e && e.message ? e.message : e), null);
      return;
    }
    finish(null, url);
  };

  var route0 = data.route || [];
  try {
    box.style.width = '720px';
    box.style.height = '540px';
    map.invalidateSize({ animate: false });
  } catch (e) {}
  try {
    if (route0.length > 1 && L) {
      map.fitBounds(L.latLngBounds(route0), { animate: false, padding: [40, 40] });
    }
  } catch (e) {}

  var started = false;
  var go = function () {
    if (started) { return; }
    started = true;
    setTimeout(draw, 1200);
  };
  if (tileLayer && tileLayer._loading) {
    tileLayer.once('load', go);
    setTimeout(go, 5000);
  } else {
    go();
  }
}`;