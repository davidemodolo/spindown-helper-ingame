export function screenToRenderPos(sx: number, sy: number): Vector {
  const room = Game().GetRoom();
  const tl = room.GetTopLeftPos();
  const stl = Isaac.WorldToScreen(tl);
  const ctr = room.GetCenterPos();
  const sctr = Isaac.WorldToScreen(ctr);

  const dxs = sctr.X - stl.X;
  const dys = sctr.Y - stl.Y;

  if (dxs === 0 || dys === 0) {
    return Isaac.WorldToRenderPosition(tl);
  }

  const dxw = ctr.X - tl.X;
  const dyw = ctr.Y - tl.Y;
  const wx = tl.X + ((sx - stl.X) / dxs) * dxw;
  const wy = tl.Y + ((sy - stl.Y) / dys) * dyw;

  return Isaac.WorldToRenderPosition(Vector(wx, wy));
}
