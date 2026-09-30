/* Approved OpenArt pixels, sampled by the presentation layer only. Coordinates use a 1536×1024
   reference grid; the original 3072×2048 PNGs are preserved byte for byte. No saved scene authority. */
'use strict';
const StationArt = (() => {
  const standing=[[.36,.012],[.62,.012],[.68,.075],[.65,.145],[.78,.20],[.88,.40],[.90,.54],[.80,.56],[.74,.48],[.70,.64],[.65,.85],[.73,.97],[.59,.99],[.50,.86],[.48,.70],[.42,.70],[.42,.85],[.38,.99],[.25,.99],[.24,.90],[.28,.64],[.23,.48],[.14,.56],[.06,.51],[.09,.38],[.22,.20],[.33,.15],[.30,.075]];
  const device=[[.12,0],[.84,0],[1,.16],[.98,.84],[.84,1],[.10,1],[0,.83],[0,.15]];
  // Trace each source pose independently: shoulder widths, handheld tools and boot positions
  // differ between crew members. These paths only remove painted surroundings; source colours
  // and clothing remain unchanged. Percent coordinates are relative to the literal crop box.
  const contour = value => value.trim().split(/\s+/).map(pair=>pair.split(',').map(n=>Number(n)/100));
  const npcContours = {
    'space-colony': {
      player:contour('36,2 57,1 64,5 65,13 60,18 72,21 80,28 84,40 88,51 85,58 77,59 75,51 72,44 69,54 64,75 65,83 82,89 85,92 76,94 61,91 54,77 49,63 43,77 36,88 37,95 28,97 17,96 17,91 22,83 27,68 29,54 24,47 23,54 17,60 9,57 5,52 4,43 8,31 14,23 30,18 32,12 32,6'),
      mage:contour('32,3 52,2 60,7 62,16 58,21 60,25 70,30 77,42 76,57 69,61 66,69 68,84 72,98 59,99 50,90 47,76 44,93 34,99 24,98 26,87 27,78 20,71 17,59 9,58 2,52 1,46 8,43 17,43 19,34 26,29 27,22 22,16 24,9'),
      scholar:contour('39,3 54,2 62,6 64,15 61,22 71,27 78,36 86,38 86,50 80,57 71,58 69,48 65,59 63,74 61,94 64,99 51,99 45,91 47,76 45,66 40,68 37,83 38,99 25,99 26,94 28,77 30,59 22,48 21,56 14,56 7,49 4,43 8,35 15,26 29,23 34,16 33,8'),
      ranger:contour('34,2 49,1 60,5 67,12 66,24 62,29 60,36 66,40 72,45 75,53 90,48 94,52 90,60 77,62 78,75 71,83 70,94 54,99 35,100 17,94 17,75 11,64 8,54 8,43 17,32 26,22 27,10'),
      guard:contour('32,7 44,4 57,5 64,10 66,17 63,23 75,27 80,34 84,47 83,56 76,61 70,61 68,52 65,54 64,70 63,86 71,92 73,96 68,98 59,98 53,93 49,73 47,61 41,72 36,86 39,91 34,97 22,98 17,95 18,90 22,85 23,70 25,57 22,49 20,58 15,60 10,58 10,47 8,41 10,32 17,26 27,23 28,15'),
      cook:contour('54,2 69,1 77,6 78,14 74,20 76,23 87,27 95,36 95,52 91,58 82,58 81,47 78,46 82,56 81,74 76,89 77,98 66,99 62,94 60,80 56,70 52,80 50,95 46,99 39,99 37,96 39,88 42,76 45,63 44,53 38,46 34,43 24,41 13,43 1,42 0,37 6,35 24,35 36,30 46,22 44,17 48,13 48,7'),
      banker:contour('34,7 46,5 57,7 66,13 68,22 62,28 67,33 82,38 87,48 88,57 83,62 71,67 67,68 68,78 66,89 74,98 58,99 50,96 47,85 43,70 40,85 39,95 42,99 24,99 24,95 27,84 29,66 22,54 10,51 1,47 0,43 7,40 17,42 24,44 29,39 28,32 30,28 27,20 27,12'),
      elf:contour('35,3 50,2 60,5 67,13 67,22 60,28 62,32 70,37 73,43 87,48 93,54 94,61 89,67 79,66 73,63 73,74 66,90 54,100 28,100 16,94 17,77 20,68 14,57 5,47 6,40 18,31 29,27 29,17 29,8'),
      dwarf:contour('37,3 56,2 68,7 72,14 66,19 66,25 65,28 77,31 80,40 86,47 95,52 96,57 90,59 81,57 75,52 73,61 69,73 68,86 75,97 64,99 52,94 47,79 46,65 42,73 36,86 40,97 27,99 20,97 23,87 29,70 28,57 22,52 14,56 10,51 8,41 14,30 29,24 31,15 31,8')
    },
    cyberpunk: {
      player:contour('38,2 58,2 65,6 68,15 64,23 70,25 80,30 87,40 92,54 88,59 82,60 77,56 77,48 70,57 68,73 73,85 87,92 90,96 86,98 74,97 66,92 58,79 52,66 44,77 37,88 33,98 24,99 18,97 19,90 22,78 25,62 28,54 24,50 24,57 19,60 9,58 7,51 7,40 13,29 27,23 31,17 31,9'),
      mage:contour('37,2 54,1 62,6 66,14 62,23 62,27 74,29 81,38 85,50 83,60 78,65 72,66 70,52 66,57 76,73 80,76 73,80 68,81 67,90 70,96 61,97 56,95 54,84 53,75 48,76 45,87 45,98 34,99 21,98 20,94 29,90 31,77 30,74 23,72 23,66 25,54 23,50 14,53 4,49 0,45 0,41 7,38 16,38 20,29 32,24 32,19 27,13 30,7'),
      scholar:contour('33,4 45,2 52,3 57,8 60,14 53,22 52,26 56,29 64,35 68,39 73,23 95,29 88,43 86,51 77,57 68,59 63,54 63,65 59,78 59,91 68,96 68,99 56,99 50,96 46,83 44,70 39,82 35,94 31,98 22,98 20,95 23,89 24,76 29,60 24,53 19,52 15,42 15,33 21,24 25,18 24,11 28,7'),
      ranger:contour('44,2 60,2 67,6 70,14 67,24 62,28 69,31 77,36 81,44 89,41 96,44 98,48 98,57 91,60 84,59 78,54 76,67 79,78 80,79 73,80 70,84 69,92 77,96 76,99 65,99 58,95 54,86 53,78 46,79 42,91 42,98 30,99 23,97 26,90 29,77 20,77 19,73 21,57 14,51 12,44 14,35 23,25 37,22 37,15 36,8'),
      guard:contour('43,3 60,2 68,8 70,18 67,24 76,29 84,36 90,48 86,56 82,60 76,56 86,63 98,69 99,73 96,75 88,71 76,64 70,59 76,69 79,82 80,90 88,96 86,99 75,99 69,96 65,84 61,69 55,64 49,74 44,86 40,92 41,96 31,97 22,94 20,90 25,83 30,78 32,65 29,55 24,49 18,46 9,43 8,37 13,32 21,28 33,25 33,16 36,9'),
      cook:contour('43,4 59,2 68,3 70,8 77,10 77,15 70,18 65,23 61,26 69,30 81,32 90,40 94,49 93,65 84,66 81,58 78,68 73,79 69,92 73,97 66,100 57,98 55,94 54,80 50,69 48,69 44,80 43,96 33,99 22,99 24,94 30,88 32,71 38,54 32,47 22,46 15,45 1,39 0,34 5,31 12,32 20,36 27,38 27,33 30,25 37,25 34,21 29,16 30,8'),
      banker:contour('35,2 51,1 60,5 62,13 59,20 56,22 61,27 72,30 77,39 81,40 96,28 99,29 99,33 94,37 86,42 82,49 77,54 79,59 86,67 83,69 73,70 66,66 64,81 67,93 70,98 58,99 50,98 46,92 44,77 40,89 39,98 27,99 23,98 25,92 31,81 33,63 28,56 29,50 20,48 15,41 13,35 16,27 30,23 29,17 26,12 28,7'),
      elf:contour('38,2 53,1 60,4 65,12 63,21 59,25 63,28 76,31 82,40 82,46 95,45 100,47 100,53 89,57 80,56 74,54 69,58 67,77 66,91 70,98 61,100 53,94 50,82 49,69 44,78 40,91 42,97 30,99 23,97 25,92 26,76 29,59 27,51 26,44 22,42 18,51 11,50 7,42 8,32 17,26 29,22 31,17 28,10 32,5'),
      dwarf:contour('36,7 50,5 56,8 58,13 55,20 55,25 60,28 69,30 75,40 90,47 96,48 98,53 95,57 90,61 80,64 73,57 66,59 65,76 66,89 73,97 65,99 54,96 48,83 46,68 41,75 36,91 38,96 31,99 20,98 20,94 25,90 28,76 27,62 22,58 22,49 15,56 10,54 6,43 6,32 16,25 29,22 29,16 30,11')
    },
    'starship-bridge': {
      player:contour('39,2 55,2 61,5 65,12 61,21 62,23 75,28 82,39 87,53 84,64 76,65 74,55 70,47 69,60 62,78 67,89 73,96 71,99 60,99 54,94 49,74 45,70 41,83 41,97 35,99 24,99 23,96 25,91 26,76 29,63 29,54 25,48 23,57 20,66 12,65 7,62 6,51 6,43 13,30 28,23 30,16 33,7'),
      mage:contour('33,2 48,1 58,4 61,13 62,23 63,28 74,32 80,43 81,51 78,61 71,62 69,54 64,63 66,76 71,83 64,87 62,89 64,96 56,98 48,97 47,91 47,77 42,74 42,85 42,99 30,99 22,97 25,92 28,90 27,76 25,70 20,63 21,50 11,44 2,41 0,37 4,31 13,31 18,28 26,23 29,18 29,8'),
      scholar:contour('42,3 53,3 59,7 59,14 56,24 56,26 69,33 76,46 77,57 78,69 77,90 73,94 69,94 68,84 66,70 61,76 61,93 34,98 25,91 27,74 25,82 19,86 15,81 15,66 19,45 25,34 36,29 35,19 36,9'),
      ranger:contour('21,3 37,1 45,7 51,17 48,27 42,35 40,38 49,40 58,49 69,59 76,73 88,64 91,67 91,73 87,79 88,91 80,95 69,95 60,87 55,84 55,93 18,100 7,96 2,80 0,58 3,42 17,37 17,31 11,21 13,10'),
      guard:contour('48,2 61,1 73,4 79,8 78,16 73,21 70,24 80,26 89,33 93,47 93,57 89,64 84,64 82,55 77,48 75,59 73,75 77,86 86,89 88,92 84,96 77,98 65,96 62,92 60,79 55,67 52,64 47,73 40,89 38,97 33,99 25,99 22,97 23,91 26,85 28,73 27,61 23,52 23,58 24,64 19,64 13,62 13,50 10,42 13,32 22,23 36,21 37,14 41,7'),
      cook:contour('45,2 56,1 64,3 67,9 75,9 76,13 70,14 69,22 64,26 67,28 79,29 84,36 86,50 84,64 81,67 74,67 71,58 67,73 67,87 78,93 78,96 68,98 58,96 55,87 54,73 49,64 42,77 40,95 40,99 24,99 25,95 29,88 30,76 35,64 36,51 33,45 23,44 10,46 6,45 6,39 15,35 29,37 28,31 33,26 37,23 37,19 31,14 30,8'),
      banker:contour('42,4 51,1 59,4 63,13 63,18 59,24 58,28 70,36 78,40 83,49 84,64 78,75 68,79 61,78 55,75 48,72 40,72 33,69 26,64 15,60 2,55 0,50 7,49 17,52 26,56 28,50 24,46 26,35 30,27 33,23 33,15 36,8'),
      elf:contour('40,2 54,1 63,4 66,11 62,18 58,23 62,28 72,31 74,36 80,41 94,40 100,43 100,46 93,50 82,50 75,49 74,57 67,68 62,85 65,95 66,99 57,100 53,95 51,81 48,68 43,73 38,88 39,96 33,99 21,99 21,95 28,86 28,71 29,59 33,49 33,42 24,37 21,39 17,37 17,30 20,25 30,22 33,15 33,7'),
      dwarf:contour('37,2 51,1 59,4 65,11 67,21 60,27 58,32 72,34 82,40 87,52 90,66 87,79 81,89 71,98 62,100 55,98 54,89 51,81 47,81 44,95 37,99 25,99 22,94 22,81 14,81 10,73 6,53 5,39 17,30 30,26 27,17 29,8')
    },
    'steampunk-airship': {
      player:contour('38,1 58,1 63,5 64,13 61,18 64,23 75,27 81,36 81,43 80,51 75,52 73,44 69,47 68,60 69,75 74,79 72,82 65,83 62,77 60,83 62,91 77,96 78,98 68,99 56,96 50,87 47,75 43,77 37,92 36,99 24,99 22,96 24,89 27,74 32,69 25,77 19,75 23,61 25,52 24,47 20,48 15,43 10,42 0,37 0,29 12,20 29,16 29,9'),
      mage:contour('32,4 46,2 60,4 65,12 64,21 60,24 64,29 73,35 78,48 78,60 71,68 71,83 77,90 77,96 66,98 55,94 50,82 47,79 43,83 42,97 28,99 19,96 23,92 28,89 27,77 21,71 20,61 23,50 28,45 18,43 10,39 0,36 0,31 7,28 17,29 23,32 26,30 26,23 22,18 23,12'),
      scholar:contour('39,4 54,3 63,7 66,16 62,24 57,28 65,30 76,34 80,41 89,35 98,36 100,44 96,50 84,55 83,69 86,78 86,81 78,83 71,82 70,89 80,98 63,99 55,92 53,82 49,85 46,99 32,99 29,96 33,88 31,78 22,82 14,80 22,65 23,51 18,51 12,48 5,47 0,42 0,31 10,27 29,24 32,19 32,10'),
      ranger:contour('38,2 52,1 61,4 64,10 58,20 55,23 62,26 69,28 74,34 78,37 94,31 100,30 100,35 98,39 87,42 80,44 74,44 73,54 77,66 74,71 68,74 66,89 72,97 62,99 56,92 51,80 49,70 43,74 38,85 38,95 39,99 28,99 26,93 29,82 28,76 15,77 7,74 8,69 13,60 12,47 6,39 5,31 11,22 28,19 25,13 26,7'),
      guard:contour('46,3 56,2 61,5 61,9 64,15 59,23 68,24 82,30 93,38 92,53 85,60 79,57 81,47 78,44 75,56 72,73 70,89 74,93 74,97 67,99 57,97 53,94 52,80 48,72 43,78 42,86 34,90 26,89 20,88 20,84 29,81 31,66 31,56 28,45 24,38 18,40 7,41 1,38 0,33 9,30 25,26 33,25 34,18 35,8'),
      cook:contour('41,2 56,1 64,6 67,14 65,23 64,27 75,28 85,35 93,48 95,61 88,64 81,57 80,73 82,86 91,94 92,97 85,99 75,97 69,90 63,78 58,71 53,80 51,92 55,97 50,99 41,98 36,95 38,89 44,81 45,68 47,60 44,52 38,47 35,46 23,49 14,47 1,44 0,40 4,36 15,36 24,39 32,37 34,31 29,29 17,30 11,28 11,25 24,25 32,24 32,20 26,16 26,9'),
      banker:contour('36,3 51,2 58,6 65,15 65,21 59,24 60,30 71,33 80,40 88,58 89,77 81,92 76,100 62,99 59,89 56,78 52,72 50,76 47,90 44,97 34,100 23,99 23,93 29,82 23,73 16,72 9,71 0,71 0,65 5,57 11,58 12,43 19,29 32,24 31,17 30,9'),
      elf:contour('42,2 61,2 69,6 73,13 73,17 65,20 65,26 60,29 69,32 75,35 81,41 91,40 100,39 100,45 90,49 84,52 77,52 70,64 73,77 70,85 67,91 73,97 62,99 51,96 49,84 47,71 43,73 41,87 40,96 32,99 21,97 17,94 22,86 24,71 20,63 21,52 18,46 16,43 6,37 5,32 12,22 23,17 32,15 32,9'),
      dwarf:contour('39,3 54,2 63,6 71,14 70,24 65,29 70,32 77,37 85,48 85,56 91,65 97,75 99,77 99,85 90,87 80,83 70,76 64,79 63,98 52,100 33,99 25,95 23,80 15,81 11,76 10,70 14,64 12,53 6,48 6,39 18,28 31,26 29,19 30,10')
    },
    'secret-agent-hq': {
      player:contour('39,2 56,2 63,6 63,13 58,21 60,23 73,27 82,36 86,45 90,54 90,58 85,59 78,56 75,47 71,43 67,55 66,72 72,85 87,91 89,94 84,97 76,95 64,91 56,78 50,65 46,75 39,89 36,95 38,97 31,99 20,98 16,94 21,88 24,72 28,57 27,50 23,47 22,51 23,57 18,59 10,57 8,52 8,44 4,39 6,32 14,23 29,18 31,12 33,6'),
      mage:contour('36,4 49,2 58,4 63,10 61,19 59,25 65,27 72,32 78,46 78,55 72,61 74,65 81,74 78,78 70,79 66,78 65,89 68,95 61,97 54,96 52,88 51,79 47,79 46,91 43,98 33,99 22,96 24,92 30,89 30,78 27,77 24,73 23,62 27,49 25,46 16,43 5,39 0,34 0,29 8,30 15,33 25,36 28,33 33,28 35,24 30,19 28,12'),
      scholar:contour('37,2 57,1 62,7 64,13 65,18 58,22 59,25 70,28 77,34 84,40 94,39 100,37 100,43 96,47 81,50 76,52 72,65 67,64 62,61 58,72 60,87 64,94 69,97 68,99 57,98 52,94 49,80 46,67 41,79 39,96 30,99 20,97 21,93 28,88 29,73 28,59 23,47 21,50 22,58 15,60 10,53 11,39 12,30 23,22 31,18 31,10'),
      ranger:contour('19,5 28,3 34,8 40,16 45,26 42,35 39,45 49,52 57,63 63,67 74,52 80,56 77,70 74,77 84,84 85,91 78,99 65,98 52,89 47,91 18,99 9,96 11,82 8,70 4,65 0,64 0,44 9,39 9,24 10,14'),
      guard:contour('38,2 56,1 65,6 69,12 67,18 63,22 64,24 77,28 83,34 87,46 84,51 78,54 90,56 99,63 100,65 97,66 83,61 76,57 67,53 67,67 67,84 73,92 77,95 75,98 65,98 59,95 57,80 50,67 44,76 35,88 33,92 32,94 24,94 17,93 13,90 18,85 25,77 26,64 24,52 20,47 11,43 1,37 0,32 3,27 13,22 23,19 31,17 31,10'),
      cook:contour('36,2 56,1 63,6 65,14 64,22 58,27 61,30 75,33 83,44 82,55 78,59 72,59 74,73 72,81 69,81 69,91 76,98 64,99 56,94 54,83 52,73 47,71 43,78 41,90 42,99 28,100 22,97 25,93 28,78 28,68 23,65 22,58 21,48 16,50 6,49 0,45 0,41 12,40 22,42 27,37 28,29 30,24 25,17 26,9'),
      banker:contour('37,2 57,2 65,7 68,14 64,20 60,24 57,26 65,30 73,32 79,40 80,50 77,55 67,55 70,68 65,70 62,78 64,89 69,96 61,99 54,98 48,89 46,78 41,74 38,84 38,96 34,99 26,99 24,95 27,84 27,71 25,67 27,56 27,49 16,47 8,42 5,36 0,34 0,29 9,28 23,30 29,28 34,22 30,18 31,10'),
      elf:contour('38,2 58,1 66,6 68,13 64,20 58,23 62,26 73,30 80,38 84,43 92,39 100,37 100,43 95,49 85,52 77,49 71,55 68,75 67,88 76,94 77,97 66,100 56,96 54,88 53,77 47,71 42,85 42,96 33,99 23,98 23,94 29,88 29,72 27,65 24,55 22,47 15,41 9,35 9,28 19,22 31,17 32,10'),
      dwarf:contour('39,2 53,1 59,4 63,9 62,17 60,22 59,25 65,29 75,33 80,40 82,44 94,41 100,42 100,49 91,52 81,54 72,50 68,49 66,66 64,80 65,90 72,97 65,99 55,97 50,86 47,72 43,70 39,85 40,96 34,99 22,99 20,96 24,90 27,76 27,64 27,53 23,48 17,46 13,41 7,34 7,29 16,20 29,16 33,11')
    }
  };

  const dish=[[.34,0],[.63,0],[.94,.16],[1,.49],[.86,.67],[.61,.76],[.60,.86],[.82,.89],[.89,1],[.15,1],[.22,.85],[.39,.80],[.40,.69],[.15,.62],[0,.34],[.08,.12]];
  const models = {
    'space-colony': {name:'Space Colony',historyId:'qmAyhwuvo0zonqYjTdgA',floor:[589,338,18,20],wall:[556,674,51,26],cap:[593,649,113,6],window:[477,4,385,82],palette:['#131920','#45505a','#dbb273','#eab84c','#797d79'],chatTop:729,
      npc:{player:[645,298,55,124],mage:[470,158,46,94],scholar:[642,142,62,94],ranger:[850,193,58,62],guard:[940,312,65,133],cook:[292,316,59,110],banker:[406,474,60,120],elf:[862,524,63,91],dwarf:[997,477,70,116]},
      props:{computer:[595,109,164,119],workbench:[1043,515,88,79],cabinet:[341,210,38,71],dish:[1026,225,106,154],notebook:[949,452,42,113],studio:[877,180,93,41],table:[599,441,155,152],plant:[799,68,48,122],portal:[949,452,42,113]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    cyberpunk:{name:'Cyberpunk Workshop',historyId:'OKvsp0UYpZ7zYNYq9JrT',floor:[570,407,45,54],wall:[864,728,78,21],cap:[875,716,59,7],window:[460,0,462,110],palette:['#061017','#26343d','#58d8e9','#edc553','#536573'],chatTop:763,
      npc:{player:[662,381,57,126],mage:[414,231,59,124],scholar:[660,227,64,124],ranger:[918,232,61,127],guard:[1010,388,68,137],cook:[366,393,58,132],banker:[441,553,66,156],elf:[836,518,63,134],dwarf:[941,562,75,141]},
      props:{computer:[625,139,176,64],workbench:[1004,593,93,84],cabinet:[518,274,49,101],dish:[1033,238,40,96],notebook:[785,355,65,143],studio:[966,230,89,45],table:[553,539,251,167],plant:[326,595,34,62],portal:[785,355,65,143]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    'starship-bridge':{name:'Starship Bridge',historyId:'P4XJcfdWVViXfltDF4lG',floor:[565,321,48,48],wall:[404,696,60,10],cap:[394,674,89,8],window:[516,74,434,46],palette:['#08141f','#243949','#bcbcad','#ecc66c','#526574'],chatTop:729,
      npc:{player:[642,303,65,121],mage:[404,188,55,124],scholar:[644,157,66,73],ranger:[897,193,44,62],guard:[898,308,60,139],cook:[297,337,66,146],banker:[372,509,64,85],elf:[971,464,61,137],dwarf:[802,550,57,75]},
      props:{computer:[585,126,179,78],workbench:[832,590,137,94],cabinet:[239,185,84,125],dish:[1031,150,81,155],notebook:[1076,401,63,141],studio:[891,152,113,50],table:[595,421,187,153],plant:[803,126,55,131],portal:[973,405,72,48]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    'steampunk-airship':{name:'Steampunk Airship',historyId:'vcscF6o8wdFPlCPucRLk',floor:[523,331,55,54],wall:[567,47,86,20],cap:[572,37,77,9],window:[387,155,58,53],palette:['#100e0b','#433322','#bc9346','#eed07c','#886f42'],chatTop:729,
      npc:{player:[641,306,63,130],mage:[436,188,61,137],scholar:[638,170,63,122],ranger:[842,190,60,136],guard:[978,311,73,151],cook:[315,340,73,143],banker:[371,498,67,85],elf:[918,473,63,144],dwarf:[846,561,65,94]},
      props:{computer:[622,136,111,80],workbench:[863,630,146,65],cabinet:[502,158,27,61],dish:[1027,109,106,208],notebook:[351,568,70,38],studio:[891,177,66,95],table:[564,477,223,200],plant:[827,92,67,99],portal:[1029,488,36,67]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    'secret-agent-hq':{name:'Secret-Agent HQ',historyId:'byQf0pxPAgRquxY2mbZA',floor:[557,344,56,56],wall:[1092,277,17,18],cap:[439,721,76,9],window:[553,5,324,81],palette:['#100f0b','#2e2d25','#a99e7a','#e0be59','#676955'],chatTop:763,
      npc:{player:[690,338,58,134],mage:[378,217,61,132],scholar:[623,156,57,132],ranger:[914,191,62,60],guard:[1035,365,65,165],cook:[351,401,62,130],banker:[404,558,56,147],elf:[890,538,62,156],dwarf:[994,582,78,155]},
      props:{computer:[598,120,184,84],workbench:[1060,614,92,108],cabinet:[914,392,64,96],dish:[829,169,45,129],notebook:[259,308,51,125],studio:[948,175,64,45],table:[563,506,267,123],plant:[785,89,48,132],portal:[914,392,64,96]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}}
  };
  const cache=new Map(),listeners=new Set();
  // Printed labels cross a few NPCs in the concept. Omit these narrow source bands;
  // their names/roles are rendered separately from canonical records, never baked text.
  const omittedBands={'steampunk-airship':{mage:[[.60,.75]],scholar:[[.79,.94]],ranger:[[.61,.78]]}};
  const propHeights={'secret-agent-hq':{dish:32},'steampunk-airship':{notebook:11}};
  const repairs={
    'space-colony':{computer:[600,188,22,34],studio:[930,185,25,31],workbench:[1086,545,29,34]},
    cyberpunk:{computer:[745,181,28,20],studio:[1010,235,29,34],workbench:[1044,598,24,67]},
    'starship-bridge':{computer:[718,165,28,36],studio:[967,157,24,33],workbench:[898,611,38,48]},
    'steampunk-airship':{computer:[704,182,24,32],studio:[919,227,32,24],workbench:[958,642,29,34],notebook:[356,591,30,10]},
    'secret-agent-hq':{computer:[710,160,25,38],studio:[991,181,15,30],workbench:[1092,655,30,42]}
  };
  // The concept hides some lower bodies behind desks. For moving entities, complete those
  // poses with compatible trouser/boot pixels from the same approved crew, at the same scale.
  const fullPoses={
    'space-colony':{ranger:['banker',.88],elf:['banker',.82]},
    'starship-bridge':{scholar:['player',.86],ranger:['player',.88],banker:['player',.82],dwarf:['cook',.86]},
    'steampunk-airship':{banker:['player',.84],dwarf:['cook',.82]},
    'secret-agent-hq':{ranger:['banker',.88],cook:['elf',.80]}
  };
  const plant=[[.40,0],[.65,.02],[.73,.12],[.90,.10],[.95,.25],[.82,.35],[1,.46],[.79,.57],[.77,.70],[.86,.82],[.75,.99],[.24,1],[.10,.88],[.20,.64],[.09,.56],[0,.33],[.18,.28],[.09,.14],[.34,.22]];
  const propMasks={
    'space-colony':{workbench:contour('0,0 73,0 95,15 98,27 92,46 71,70 57,100 0,96'),cabinet:contour('21,0 65,0 91,8 94,23 97,84 79,93 56,97 31,95 12,88 10,20'),notebook:contour('20,0 45,0 81,6 83,15 100,19 97,30 93,91 73,100 7,100 0,26 4,11'),portal:contour('20,0 45,0 81,6 83,15 100,19 97,30 93,91 73,100 7,100 0,26 4,11'),studio:contour('0,12 8,0 88,0 98,8 100,87 95,100 0,100')},
    cyberpunk:{dish:contour('24,0 71,0 90,8 96,17 76,22 59,25 57,39 48,40 79,89 91,94 89,100 77,100 48,53 42,96 34,100 30,99 34,54 12,89 2,92 0,87 32,45 39,36 39,25 20,21 8,13'),cabinet:contour('28,0 68,0 76,5 96,12 91,87 83,99 18,100 5,93 2,74 4,12 18,5'),studio:contour('0,10 13,0 88,0 100,14 100,96 4,100')},
    'starship-bridge':{dish:contour('47,0 58,0 77,5 90,14 96,24 96,35 85,44 73,52 62,59 67,76 71,87 82,98 18,100 31,90 47,75 53,61 52,57 34,55 22,50 14,45 8,35 4,24 7,16 18,7 31,2'),plant:contour('40,0 55,0 61,13 67,11 71,23 85,17 88,26 79,40 95,40 90,47 82,57 77,64 72,73 82,79 80,93 74,100 24,100 20,88 30,73 20,64 8,60 0,49 18,48 10,36 20,38 20,30 9,27 10,18 29,22 32,10')},
    'steampunk-airship':{plant:contour('21,4 32,9 36,3 42,12 55,0 60,11 71,3 74,19 90,21 93,35 83,41 97,43 94,51 80,55 81,65 75,69 72,79 71,94 65,100 37,100 30,94 30,76 23,65 6,61 1,47 16,47 11,38 0,33 9,27 20,34 19,26 12,20'),notebook:contour('8,35 14,24 26,15 44,23 54,25 62,24 94,26 97,36 89,74 80,92 53,100 24,85 0,67')},
    'secret-agent-hq':{workbench:contour('0,2 85,0 77,19 67,38 45,61 20,87 0,79'),dish:contour('60,0 77,0 82,6 79,12 86,18 88,28 81,37 68,43 66,49 99,83 100,91 97,92 88,83 70,62 65,53 62,61 58,94 55,100 51,100 50,95 54,60 59,53 43,66 20,86 8,89 5,86 32,69 52,52 59,46 57,37 53,30 45,30 43,23 46,17 43,15 43,6 52,3'),cabinet:contour('36,0 69,0 86,14 89,31 98,38 98,98 13,100 1,97 0,27 18,22 28,14'),portal:contour('36,0 69,0 86,14 89,31 98,38 98,98 13,100 1,97 0,27 18,22 28,14')}
  };
  const portraitFrames={
    'space-colony':{x:1207,w:32,h:30,rows:[637,670,701,732,763,794,825,857,889]},
    cyberpunk:{x:1203,w:38,h:31,rows:[623,658,693,729,764,798,833,867,901]},
    'starship-bridge':{x:1201,w:38,h:32,rows:[625,665,698,731,765,797,829,861,894]},
    'steampunk-airship':{x:1201,w:35,h:32,rows:[633,665,698,730,764,797,830,862,895]},
    'secret-agent-hq':{x:1218,w:34,h:29,rows:[628,663,692,724,755,785,815,846,877]}
  };
  // Restrict donor pixels to trousers and boots. Without this second mask, the source's
  // hanging hands at hip height would be copied as detached hands below a seated pose.
  const legContours={
    'space-colony':{banker:contour('30,65 66,65 68,78 66,89 74,98 58,99 50,96 47,85 43,70 40,85 39,95 42,99 24,99 24,95 27,84 29,66')},
    'starship-bridge':{player:contour('30,62 69,62 62,78 67,89 73,96 71,99 60,99 54,94 49,74 45,70 41,83 41,97 35,99 24,99 23,96 25,91 26,76'),cook:contour('36,63 66,63 67,87 78,93 78,96 68,98 58,96 55,87 54,73 49,64 42,77 40,95 40,99 24,99 25,95 29,88 30,76')},
    'steampunk-airship':{player:contour('31,65 66,65 62,77 60,83 62,91 77,96 78,98 68,99 56,96 50,87 47,75 43,77 37,92 36,99 24,99 22,96 24,89 27,74'),cook:contour('46,65 79,65 80,73 82,86 91,94 92,97 85,99 75,97 69,90 63,78 58,71 53,80 51,92 55,97 50,99 41,98 36,95 38,89 44,81 45,68')},
    'secret-agent-hq':{banker:contour('29,67 65,67 62,78 64,89 69,96 61,99 54,98 48,89 46,78 41,74 38,84 38,96 34,99 26,99 24,95 27,84 27,71'),elf:contour('29,66 68,66 67,88 76,94 77,97 66,100 56,96 54,88 53,77 47,71 42,85 42,96 33,99 23,98 23,94 29,88 29,72')}
  };
  for(const [id,m]of Object.entries(models)){
    m.id=id;m.source='assets/station-styles/'+id+'/reference.png';m.npc.scout=m.npc.player;m.portraits.scout=0;m.propHeights=Object.freeze(propHeights[id]||{});
    for(const table of [m.npc,m.props])for(const box of Object.values(table))Object.freeze(box);
    for(const kind of ['floor','wall','cap','window'])Object.freeze(m[kind]);
    Object.freeze(m.npc);Object.freeze(m.props);Object.freeze(m.portraits);Object.freeze(m.palette);Object.freeze(m);
  }
  function sample(image,box,width,height,path,holes,base){
    const c=document.createElement('canvas');c.width=width||Math.round(box[2]);c.height=height||Math.round(box[3]);const g=c.getContext('2d');
    if(path){g.beginPath();path.forEach(([x,y],i)=>i?g.lineTo(x*c.width,y*c.height):g.moveTo(x*c.width,y*c.height));g.closePath();g.clip();}
    if(holes?.length){
      if(base){g.fillStyle=base;g.fillRect(0,0,c.width,c.height);}
      g.beginPath();g.rect(0,0,c.width,c.height);
      for(const hole of holes){hole.forEach(([x,y],i)=>i?g.lineTo(x*c.width,y*c.height):g.moveTo(x*c.width,y*c.height));g.closePath();}g.clip('evenodd');
    }
    const k=image.naturalWidth/1536;g.drawImage(image,...box.map(n=>n*k),0,0,c.width,c.height);return c;
  }
  function load(id){
    if(!models[id]||typeof Image==='undefined'||typeof document==='undefined')return null;
    if(cache.has(id))return cache.get(id);
    const a={image:new Image(),ready:false,npc:{},portraits:{},props:{},materials:{},ui:{},model:models[id],error:false};cache.set(id,a);
    a.image.onload=()=>{try{
      const m=a.model;
      for(const kind of ['floor','wall','cap','window'])a.materials[kind]=sample(a.image,m[kind],m[kind][2]*2,m[kind][3]*2);
      const housing=id==='cyberpunk'?[1053,640,29,17]:repairs[id].computer;
      a.materials.housing=sample(a.image,housing,housing[2]*2,housing[3]*2);
      for(const [role,box]of Object.entries(m.npc)){
        const source=sample(a.image,box,box[2]*2,box[3]*2,npcContours[id]?.[role==='scout'?'player':role]||standing),bands=omittedBands[id]?.[role];
        if(!bands){a.npc[role]=source;continue;}
        const c=document.createElement('canvas');c.width=source.width;c.height=Math.round(source.height*(1-bands.reduce((sum,[a,b])=>sum+b-a,0)));
        const g=c.getContext('2d');let from=0,to=0;
        for(const [start,end]of bands){const y=Math.round(start*source.height),h=y-from;g.drawImage(source,0,from,source.width,h,0,to,source.width,h);to+=h;from=Math.round(end*source.height);}
        const h=source.height-from;if(h>0)g.drawImage(source,0,from,source.width,h,0,to,source.width,h);a.npc[role]=c;
      }
      for(const [role,[donor,upper]]of Object.entries(fullPoses[id]||{})){
        const source=a.npc[role],rawLegs=a.npc[donor],legs=document.createElement('canvas');legs.width=rawLegs.width;legs.height=rawLegs.height;
        const lg=legs.getContext('2d'),path=legContours[id]?.[donor];if(path){lg.beginPath();path.forEach(([x,y],i)=>i?lg.lineTo(x*legs.width,y*legs.height):lg.moveTo(x*legs.width,y*legs.height));lg.closePath();lg.clip();}lg.drawImage(rawLegs,0,0);
        const upperH=Math.round(source.height*upper),legY=Math.round(legs.height*(path?Math.min(...path.map(([,y])=>y)):.62)),legH=legs.height-legY;
        const overlap=Math.max(2,Math.round(source.height*.08)),c=document.createElement('canvas');c.width=source.width;c.height=upperH+legH-overlap;const g=c.getContext('2d'),legW=c.width*.89;
        g.drawImage(legs,0,legY,legs.width,legH,(c.width-legW)/2,upperH-overlap,legW,legH);g.drawImage(source,0,0,source.width,upperH,0,0,source.width,upperH);a.npc[role]=c;
      }
      a.npc.scout=a.npc.player;
      const face=portraitFrames[id];for(const [role,row]of Object.entries(m.portraits))a.portraits[role]=sample(a.image,[face.x,face.rows[row],face.w,face.h],64,64);
      for(const [kind,box]of Object.entries(m.props)){
        // Reconstruct occluded desk panels from clean areas of the SAME concept. Rectangular
        // housings avoid leaving a frozen worker or worker-shaped cutout inside live equipment.
        const path=propMasks[id]?.[kind]||(kind==='dish'?dish:kind==='plant'?plant:device),c=sample(a.image,box,box[2]*2,box[3]*2,path),g=c.getContext('2d'),clean=repairs[id]?.[kind];
        if(clean){g.save();g.beginPath();path.forEach(([x,y],i)=>i?g.lineTo(x*c.width,y*c.height):g.moveTo(x*c.width,y*c.height));g.closePath();g.clip();}
        for(const [role,npc]of Object.entries(m.npc)){if(role==='scout')continue;
          if(clean&&npc[0]<box[0]+box[2]&&npc[0]+npc[2]>box[0]&&npc[1]<box[1]+box[3]&&npc[1]+npc[3]>box[1]){
            const k=a.image.naturalWidth/1536,x=Math.max(box[0],npc[0]-1),y=Math.max(box[1],npc[1]-1),right=Math.min(box[0]+box[2],npc[0]+npc[2]+1),bottom=Math.min(box[1]+box[3],npc[1]+npc[3]+1);
            g.drawImage(a.image,...clean.map(n=>n*k),(x-box[0])*2,(y-box[1])*2,(right-x)*2,(bottom-y)*2);
          }
        }
        if(clean)g.restore();a.props[kind]=c;
      }
      const chatH=947-m.chatTop;
      const surfaces={brand:[0,0,452,118],nav:[0,116,205,m.chatTop-116],panel:[1175,296,361,650],map:[1175,0,361,296],chat:[0,m.chatTop,1175,chatH],texture:[18,645,164,39],chatTexture:[620,m.chatTop+125,235,30],button:[8,951,114,62]};
      for(const [name,box]of Object.entries(surfaces))a.ui[name]=sample(a.image,box).toDataURL('image/png');
      a.ready=true;listeners.forEach(fn=>fn(id));applyUI(id);
    }catch(_){a.error=true;listeners.forEach(fn=>fn(id));}};
    a.image.onerror=()=>{a.error=true;listeners.forEach(fn=>fn(id));};a.image.src=a.model.source;return a;
  }
  function applyUI(id){
    if(typeof PresentationThemes==='undefined'||PresentationThemes.get()!==id||typeof document==='undefined'||!document.body)return;
    const a=load(id);if(!a?.ready)return;
    for(const [name,url]of Object.entries(a.ui))document.body.style.setProperty('--station-art-'+name,'url("'+url+'")');
    document.body.style.setProperty('--station-art-source','url("'+a.model.source+'")');
    document.body.style.setProperty('--station-art-chat-height',String(a.model.chatTop===729?213:179)+'px');
    document.body.style.setProperty('--station-art-floor',a.model.palette[0]);
    document.body.style.setProperty('--station-art-frame',a.model.palette[1]);
    document.body.style.setProperty('--station-art-edge',a.model.palette[2]);
    document.body.style.setProperty('--station-art-gold',a.model.palette[3]);
  }
  return {models:Object.freeze(models),has:id=>!!models[id],load,sample,applyUI,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},ready:id=>!!cache.get(id)?.ready};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StationArt;
