local M = {}
M.type = 'auxilliary'
M.relevantDevice = nil

local drlDelay = 0.4
local drlDelayTimer_L = 0
local drlDelayTimer_R = 0
local signalLeftWasActive = false
local signalRightWasActive = false

local function updateGFX(dt)
  local signalLeft = (electrics.values.signal_left_input == 1 or electrics.values.hazard_enabled == 1)
  local signalRight = (electrics.values.signal_right_input == 1 or electrics.values.hazard == 1)

  -- Левая сторона
  if signalLeft then
    electrics.values.drl_signal_L = 0
    drlDelayTimer_L = 0
    signalLeftWasActive = true
  else
    if signalLeftWasActive then
      drlDelayTimer_L = drlDelay
      signalLeftWasActive = false
    end

    if drlDelayTimer_L > 0 then
      drlDelayTimer_L = drlDelayTimer_L - dt
      electrics.values.drl_signal_L = 0
    elseif electrics.values.engineRunning == 1 then
      electrics.values.drl_signal_L = 1
    else
      electrics.values.drl_signal_L = 0
    end
  end

  -- Правая сторона
  if signalRight then
    electrics.values.drl_signal_R = 0
    drlDelayTimer_R = 0
    signalRightWasActive = true
  else
    if signalRightWasActive then
      drlDelayTimer_R = drlDelay
      signalRightWasActive = false
    end

    if drlDelayTimer_R > 0 then
      drlDelayTimer_R = drlDelayTimer_R - dt
      electrics.values.drl_signal_R = 0
    elseif electrics.values.engineRunning == 1 then
      electrics.values.drl_signal_R = 1
    else
      electrics.values.drl_signal_R = 0
    end
  end

  -- Управление аварийкой (отдельная логика, если нужно)
  if electrics.values.hazard_enabled == 1 then
    electrics.values.hazard1 = 0
  else
    electrics.values.hazard1 = 1
  end
end

-- public interface
M.onInit = nop
M.updateGFX = updateGFX
return M
