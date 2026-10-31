-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local htmlTexture = require("htmlTexture")

local gaugesScreenName = nil
local htmlPath = nil
local updateFPS = 30

local function updateGFX(dt)
  if electrics.values.rearCam == 1 then
    local data = {
      steering = electrics.values.steering,
      speed = electrics.values.wheelspeed
    }

    htmlTexture.call(gaugesScreenName, "update", data)
  end
end

local function init(jbeamData)
  gaugesScreenName = jbeamData.materialName or "@acmrivian_reversecam_overlay"
  htmlPath = jbeamData.htmlPath or "local://local/vehicles/acmrivian/gauges_screen/reversecam_overlay.html"
  local width = jbeamData.textureWidth or 512
  local height = jbeamData.textureHeight or 256

  if not gaugesScreenName then
    M.updateGFX = nop
  else
    if htmlPath then
      htmlTexture.create(gaugesScreenName, htmlPath, width, height, updateFPS, "automatic")
    else
      M.updateGFX = nop
    end
  end
end

M.updateGFX = updateGFX
M.init = init

return M