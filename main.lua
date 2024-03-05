local mod = RegisterMod("SpindownHelper", 1)

local showText = false
local DC = false

local font = Font()
font:Load("font/pftempestasevencondensed.fnt")

colors_shades = {}

local function HSLToRGB(h, s, l)
    h = h / 360
    local r, g, b

    if s == 0 then
        r, g, b = l, l, l -- achromatic
    else
        local function hueToRGB(p, q, t)
            if t < 0 then
                t = t + 1
            end
            if t > 1 then
                t = t - 1
            end
            if t < 1 / 6 then
                return p + (q - p) * 6 * t
            end
            if t < 1 / 2 then
                return q
            end
            if t < 2 / 3 then
                return p + (q - p) * (2 / 3 - t) * 6
            end
            return p
        end

        local q = l < 0.5 and l * (1 + s) or l + s - l * s
        local p = 2 * l - q
        r = hueToRGB(p, q, h + 1 / 3)
        g = hueToRGB(p, q, h)
        b = hueToRGB(p, q, h - 1 / 3)
    end

    return r, g, b
end

for i = 1, 100 do
    local hue = i * (360 / 100)
    local r, g, b = HSLToRGB(hue, 1, 0.5)
    table.insert(colors_shades, KColor(r, g, b, 1))
end

local function getColor(extra)
    extra = extra or 0
    local frames = Game():GetFrameCount() + extra
    local index = (frames % 100) + 1
    return colors_shades[index]
end

local colors = {
    ["no"] = KColor(200 / 255, 0 / 255, 0 / 255, 1),
    ["5"] = KColor(0 / 255, 255 / 255, 0 / 255, 1),
    ["25"] = KColor(128 / 255, 235 / 255, 0 / 255, 1),
    ["50"] = KColor(182 / 255, 255 / 255, 0 / 255, 1),
    ["100"] = KColor(255 / 255, 182 / 255, 0 / 255, 1),
    [">100"] = KColor(255 / 255, 128 / 255, 0 / 255, 1)
}

function splitString(inputstr, sep)
    local t = {}
    for str in string.gmatch(inputstr, "([^" .. sep .. "]+)") do
        table.insert(t, str)
    end
    return t
end

local file = io.open("mods\\spindown-helper\\resources\\dict.txt", "r")
local dict = {}
if file then
    for line in file:lines() do
        local split = splitString(line, ",")
        local game_id = 0
        local my_id = 0
        for i, v in ipairs(split) do
            if i == 2 then
                game_id = tonumber(v)
            elseif i == 3 then
                my_id = tonumber(v)
            end
        end
        dict[game_id] = my_id
    end
    file:close()
end

-- create dict-reverse
local dict_reverse = {}
for k, v in pairs(dict) do
    dict_reverse[v] = k
end

local function getSpins(from_id, to_id, car_battery_bool)
    from_id = dict[from_id]
    if not from_id then
        return "", colors["no"]
    end
    local steps = from_id - to_id

    if steps < 0 then
        return "NO", colors["no"]
    end
    local dads_note_id = 656
    local dn_steps = from_id - dads_note_id
    if (from_id >= dads_note_id and to_id <= dads_note_id and (not car_battery_bool or dn_steps % 2 == 0)) then
        return "DN", colors["no"]
    end
    if (car_battery_bool and steps % 2 == 1) then
        return "CB", colors["no"]
    end
    if (car_battery_bool and steps % 2 == 0) then
        steps = steps / 2
    end
    local returned_color = colors["no"]

    if steps >= 100 then
        returned_color = colors[">100"]
    elseif steps >= 50 then
        returned_color = colors["100"]
    elseif steps >= 25 then
        returned_color = colors["50"]
    elseif steps >= 5 then
        returned_color = colors["25"]
    else
        returned_color = colors["5"]
    end

    return math.floor(steps), returned_color
end

local function printText()
    if not showText then
        return
    end
    local file_id = io.open("mods\\spindown-helper\\resources\\selected_id.txt", "r")
    local looking_for_id = 0
    if file_id then
        looking_for_id = tonumber(file_id:read("*a"))
        file_id:close()
    end
    local show_id = dict_reverse[looking_for_id]
    local file = io.open("mods\\spindown-helper\\resources\\selected.txt", "r")
    if file then
        local text = file:read("*a")
        file:close()

        -- GESTIONE SPRITE
        local itemSprite = Sprite();
        local itemConfig = Isaac.GetItemConfig():GetCollectible(show_id)
        local descriptor = itemConfig.GfxFileName
        itemSprite:Load("gfx/005.100_Collectible.anm2", true)
        itemSprite:ReplaceSpritesheet(1, descriptor)
        itemSprite:LoadGraphics()
        itemSprite.Color = Color(1, 1, 1, 1)
        itemSprite:SetFrame("Idle", 8)
        itemSprite.Scale = Vector(0.5, 0.5)
        local OFFSET = 17
        local Y = 201
        itemSprite:Render(Vector(8, Y + OFFSET))

        -- GESTIONE TESTO
        font:DrawStringScaled(text, 15, Y, 0.5, 0.5, KColor(255 / 255, 255 / 255, 255 / 255, 0.5), 0, true)
    end

    local player = Isaac.GetPlayer(0)
    local cb = false
    if player:HasCollectible(356) then
        cb = true
    end

    local entities = Isaac.GetRoomEntities()
    for i = 1, #entities do
        local entity = entities[i]
        if entity.Type == EntityType.ENTITY_PICKUP and entity.Variant == 100 then -- this should filter to only active or passive items
            local screenPosition = Isaac.WorldToScreen(entity.Position)
            local txt, color = getSpins(entity.SubType, looking_for_id, cb)
            font:DrawString(txt, screenPosition.X - 7, screenPosition.Y - 15, color, 0, false)
        end
    end

end
local currentTime = os.date("*t")

local function onInput(entity, hook, button)
    if Input.IsButtonPressed(Keyboard.KEY_F1, 0) then
        showText = true
    else
        showText = false
    end
    if Input.IsButtonPressed(Keyboard.KEY_F3, 0) then
        local now = os.date("*t") -- Convert the current time to a table
        local diff = os.difftime(os.time(now), os.time(currentTime))
        if diff > 0.1 then
            DC = not DC
            currentTime = now
        end
    end
end
local f2 = Font() -- init font object
f2:Load("font/upheaval.fnt")
local function drawCircleAsDots(center, radius)
    local center = Vector(center.X + 1, center.Y - 9)
    local dots = 100
    for i = 1, dots do
        local angle = (i / dots) * 2 * math.pi
        local x = center.X + radius * math.cos(angle)
        local y = center.Y + radius * math.sin(angle)
        -- Isaac.RenderText("\007", x, y, 0, 1, 1, 255)
        f2:DrawStringScaled(".", x, y, 0.5, 1, getColor(i), 0, true)
    end
end

local function DeathCertificateFinder()
    if not DC then
        return
    end
    local file = io.open("mods\\spindown-helper\\resources\\selected.txt", "r")
    local item_text = ""
    if file then
        item_text = file:read("*a")
        file:close()
    end
    local file_id = io.open("mods\\spindown-helper\\resources\\selected_id.txt", "r")
    local looking_for_id = 0
    if file_id then
        looking_for_id = tonumber(file_id:read("*a"))
        file_id:close()
    end
    local show_id = dict_reverse[looking_for_id]

    local itemSprite = Sprite();
    local itemConfig = Isaac.GetItemConfig():GetCollectible(show_id)
    local descriptor = itemConfig.GfxFileName
    itemSprite:Load("gfx/005.100_Collectible.anm2", true)
    itemSprite:ReplaceSpritesheet(1, descriptor)
    itemSprite:LoadGraphics()
    itemSprite.Color = Color(1, 1, 1, 1)
    itemSprite:SetFrame("Idle", 8)
    itemSprite.Scale = Vector(0.7, 0.7)
    itemSprite:Render(Vector(210, 295))

    local player = Isaac.GetPlayer(0)
    local playerPos = Isaac.WorldToScreen(player.Position)
    local centerPlayer = Vector(playerPos.X - 3, playerPos.Y - 20)
    local radius = 25
    local entities = Isaac.GetRoomEntities()
    local wiggleSpeed = 0.2
    local wiggleAmplitude = 0.25
    local time = Game():GetFrameCount() * wiggleSpeed
    local wiggleOffsetX = math.abs((math.sin(time) * wiggleAmplitude)) + 1
    local wiggleOffsetY = math.abs((math.cos(time) * wiggleAmplitude)) + 1
    local found = false
    local entityX = 0
    local entityY = 0
    for i = 1, #entities do
        local entity = entities[i]
        if entity.Type == EntityType.ENTITY_PICKUP and entity.Variant == 100 and entity.SubType == show_id then
            found = true
            local screenPosition = Isaac.WorldToScreen(entity.Position)
            entityX = screenPosition.X
            entityY = screenPosition.Y
            break

        end
    end
    if found then
        font:DrawStringScaled(item_text .. " is here!", 220, 270, 1, 1, getColor(), 0, true)
        local stringa = "In this room: " .. item_text
        local vector = Vector(entityX - 3 - centerPlayer.X, entityY - 20 - centerPlayer.Y)
        vector = vector:Normalized()
        local angle = math.atan(vector.Y, vector.X)
        local x = centerPlayer.X + radius * math.cos(angle)
        local y = centerPlayer.Y + radius * math.sin(angle)

        Isaac.RenderText("\007", x, y, 1, 1, 1, 255)
        drawCircleAsDots(Vector(entityX - 3, entityY - 29), 17)
    else
        font:DrawStringScaled("Looking for " .. item_text, 220, 270, 1, 1, KColor(255 / 255, 255 / 255, 255 / 255, 1), 0, true)
    end
end

mod:AddCallback(ModCallbacks.MC_POST_RENDER, printText)
mod:AddCallback(ModCallbacks.MC_POST_RENDER, DeathCertificateFinder)
mod:AddCallback(ModCallbacks.MC_INPUT_ACTION, onInput, InputHook.IS_ACTION_PRESSED)
