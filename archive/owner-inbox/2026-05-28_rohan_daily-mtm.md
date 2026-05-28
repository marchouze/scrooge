---
agent: Rohan
trigger: daily-mtm
asOf: 2026-05-28T05:59:20.678Z
decision-required: false
---

# Rohan — daily MTM run, 2026-05-28

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 135 live · 0 stale-mark · 1 unvalued · net unrealised P&L delta ZAR -18 491 783,51 · runId `a66e6584-7a33-4cc4-9434-2ad5c2d7cc0a`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `CONDUCT-TEST-0001` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `CONDUCT-TEST-0002` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `CONDUCT-TEST-0003` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `CONDUCT-TEST-0004` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `CONDUCT-TEST-0005` | USD/ZAR | revalued | 18.5200 | 16.4674 | 205 257,00 | twelve-data |
| `CONDUCT-TEST-0006` | USD/ZAR | revalued | 18.5010 | 16.4674 | 203 357,00 | twelve-data |
| `CONDUCT-TEST-0007` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `CONDUCT-TEST-0008` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `CONDUCT-TEST-0009` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `CONDUCT-TEST-0010` | USD/ZAR | revalued | 18.5000 | 16.4674 | 203 257,00 | twelve-data |
| `SIM-1779862411440-327997AA` | USD/ZAR | revalued | 18.5025 | 16.4674 | 8 944 761,40 | twelve-data |
| `SIM-1779863431267-848998ED` | GBP/ZAR | revalued | 22.0122 | 22.0370 | -160 003,32 | twelve-data |
| `SIM-1779863434806-E22C6475` | USD/ZAR | revalued | 16.3511 | 16.4674 | -315 113,60 | twelve-data |
| `SIM-1779863442744-32EFAB8B` | EUR/ZAR | revalued | 19.0542 | 19.0919 | -254 680,58 | twelve-data |
| `REG-PRIN-d5906b36-53fb-43ee-95d1-bd1516ca016a` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-9eadf1a0-49ab-4fdf-87c4-8b30f1344b35` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-01c65672-e520-42a2-ae53-a7167e1a372a` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-e980a077-3372-42fc-bc17-47f6e8fa96fe` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-89c5d71d-fb4a-4d6e-969d-62882bce6f03` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-7ad67aa4-75ed-48d1-90d3-38d0809ed29d` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-2077b198-26f8-4220-97c3-a3d1f39ba971` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-77c341b4-117a-4490-99f9-b6c487f5e360` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-ec03ea5c-8133-4e96-aac7-8b4af2822234` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-d52ef77e-7d24-42e4-b395-b2a8de6e8ae4` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-a813980a-4a7f-40d7-837e-fc056a4e9d84` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-b089d078-3537-482d-aa9c-5bfe5f8fa3a4` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-07f7843f-ec20-43ba-b9cd-730ff625cf89` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-a0212e53-a612-48e5-b657-097ebecf152f` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `REG-PRIN-23de3fd5-f4f6-4418-8b90-eb553a998fa8` | USD/ZAR | revalued | 18.5000 | 16.4674 | -2 032 570,00 | twelve-data |
| `SIM-1779900404402-A40EBF2F` | USD/ZAR | revalued | 16.3843 | 16.4674 | 57 159,02 | twelve-data |
| `SIM-1779900408875-1FED954D` | USD/ZAR | revalued | 16.3811 | 16.4674 | 9 798,18 | twelve-data |
| `SIM-1779900415742-FD87B59C` | USD/ZAR | revalued | 16.3653 | 16.4674 | 42 219,37 | twelve-data |
| `SIM-1779900420879-E7509ABA` | USD/ZAR | revalued | 16.3846 | 16.4674 | 42 293,04 | twelve-data |
| `SIM-1779900427395-FB82F059` | USD/ZAR | revalued | 16.3689 | 16.4674 | 14 223,88 | twelve-data |
| `SIM-1779900430689-7404B30F` | USD/ZAR | revalued | 16.3681 | 16.4674 | 9 812,19 | twelve-data |
| `SIM-1779900436880-CF151ACE` | USD/ZAR | revalued | 16.3699 | 16.4674 | 18 257,45 | twelve-data |
| `SIM-1779900443532-ADB221B8` | USD/ZAR | revalued | 16.3901 | 16.4674 | 2 538,05 | twelve-data |
| `SIM-1779900450050-15E79A0D` | USD/ZAR | revalued | 16.3763 | 16.4674 | 80 952,08 | twelve-data |
| `SIM-1779900454199-ABD8D823` | USD/ZAR | revalued | 16.3822 | 16.4674 | 63 956,73 | twelve-data |
| `SIM-1779900461218-21B1A046` | USD/ZAR | revalued | 16.3968 | 16.4674 | 23 166,98 | twelve-data |
| `SIM-1779900461826-B45646FA` | USD/ZAR | revalued | 16.3781 | 16.4674 | 101 431,15 | twelve-data |
| `SIM-1779900462703-8FEE8FC6` | USD/ZAR | revalued | 16.3933 | 16.4674 | 54 420,30 | twelve-data |
| `SIM-1779900463399-0E71EC4F` | USD/ZAR | revalued | 16.3730 | 16.4674 | 4 939,42 | twelve-data |
| `SIM-1779900464001-371E7D87` | USD/ZAR | revalued | 16.3721 | 16.4674 | 10 937,96 | twelve-data |
| `SIM-1779900464449-C5420B4C` | USD/ZAR | revalued | 16.3765 | 16.4674 | 39 888,59 | twelve-data |
| `SIM-1779900465072-268D2CD8` | USD/ZAR | revalued | 16.3780 | 16.4674 | 7 509,36 | twelve-data |
| `SIM-1779900465754-FBFC639A` | USD/ZAR | revalued | 16.3895 | 16.4674 | 5 165,18 | twelve-data |
| `SIM-1779900466548-A6CF4D40` | USD/ZAR | revalued | 16.3877 | 16.4674 | 8 667,79 | twelve-data |
| `SIM-1779900467162-6F4B8300` | USD/ZAR | revalued | 16.3655 | 16.4674 | 18 612,40 | twelve-data |
| `SIM-1779900468153-0EF05749` | USD/ZAR | revalued | 16.3744 | 16.4674 | 14 358,74 | twelve-data |
| `SIM-1779900469287-162FC543` | USD/ZAR | revalued | 16.3888 | 16.4674 | 39 791,86 | twelve-data |
| `SIM-1779900469853-DD4E81C0` | USD/ZAR | revalued | 16.3748 | 16.4674 | 8 337,32 | twelve-data |
| `SIM-1779900470671-94355EC9` | EUR/ZAR | revalued | 19.0551 | 19.0919 | 748,46 | twelve-data |
| `SIM-1779900471172-1D1084CC` | GBP/ZAR | revalued | 22.0007 | 22.0370 | 1 015,97 | twelve-data |
| `SIM-1779900471741-9CFF2639` | USD/ZAR | revalued | 16.3779 | 16.4674 | 13 285,16 | twelve-data |
| `SIM-1779900472133-13BDC331` | GBP/ZAR | revalued | 21.9762 | 22.0370 | 12 664,19 | twelve-data |
| `SIM-1779900472618-ACFFF5A4` | USD/ZAR | revalued | 16.3843 | 16.4674 | 3 455,83 | twelve-data |
| `SIM-1779900473746-70346C28` | USD/ZAR | revalued | 16.3749 | 16.4674 | 3 770,64 | twelve-data |
| `SIM-1779900474565-36250CBD` | USD/ZAR | revalued | 16.3733 | 16.4674 | 1 519,20 | twelve-data |
| `SIM-1779900475347-6F61944A` | USD/ZAR | revalued | 16.3963 | 16.4674 | 6 620,58 | twelve-data |
| `SIM-1779900476650-C952908F` | USD/ZAR | revalued | 16.3663 | 16.4674 | 3 253,40 | twelve-data |
| `SIM-1779900477328-53BBE9C0` | USD/ZAR | revalued | 16.3657 | 16.4674 | 1 136,95 | twelve-data |
| `SIM-1779900477999-5A11FF43` | USD/ZAR | revalued | 16.3925 | 16.4674 | 73 018,64 | twelve-data |
| `SIM-1779900478955-31EBD931` | USD/ZAR | revalued | 16.3760 | 16.4674 | 27 467,63 | twelve-data |
| `SIM-1779900479423-6DF13FD2` | USD/ZAR | revalued | 16.3663 | 16.4674 | 4 097,42 | twelve-data |
| `SIM-1779900480574-8B02E68D` | USD/ZAR | revalued | 16.3903 | 16.4674 | 11 765,70 | twelve-data |
| `SIM-1779900481101-CE3B76B4` | USD/ZAR | revalued | 16.3814 | 16.4674 | 49 193,56 | twelve-data |
| `SIM-1779900482075-B71F43A6` | USD/ZAR | revalued | 16.3820 | 16.4674 | 20 646,08 | twelve-data |
| `SIM-1779900482821-ECD8ACFF` | USD/ZAR | revalued | 16.3780 | 16.4674 | 13 459,77 | twelve-data |
| `SIM-1779900483500-8AA4D035` | USD/ZAR | revalued | 16.3724 | 16.4674 | 29 598,63 | twelve-data |
| `SIM-1779900484337-908067FE` | USD/ZAR | revalued | 16.3840 | 16.4674 | 12 955,43 | twelve-data |
| `SIM-1779900484968-27EEE55C` | USD/ZAR | revalued | 16.3943 | 16.4674 | 805,51 | twelve-data |
| `SIM-1779900485642-01253261` | USD/ZAR | revalued | 16.3967 | 16.4674 | 1 798,41 | twelve-data |
| `SIM-1779900486500-400C966B` | USD/ZAR | revalued | 16.3737 | 16.4674 | 713,60 | twelve-data |
| `SIM-1779900487526-2E3BCC3D` | USD/ZAR | revalued | 16.3812 | 16.4674 | 6 962,27 | twelve-data |
| `SIM-1779900488189-11A2193A` | USD/ZAR | revalued | 16.3808 | 16.4674 | 18 441,51 | twelve-data |
| `SIM-1779900488648-DBAB1566` | USD/ZAR | revalued | 16.3762 | 16.4674 | 9 627,06 | twelve-data |
| `SIM-1779900489145-D62F1ACE` | USD/ZAR | revalued | 16.3716 | 16.4674 | 67 190,35 | twelve-data |
| `SIM-1779900489640-59F83C67` | GBP/ZAR | revalued | 21.9850 | 22.0370 | 4 837,09 | twelve-data |
| `SIM-1779900490159-0BA18244` | GBP/ZAR | revalued | 22.0016 | 22.0370 | 2 128,98 | twelve-data |
| `SIM-1779900491148-8FBDABF0` | GBP/ZAR | revalued | 21.9889 | 22.0370 | 18 398,98 | twelve-data |
| `SIM-1779900492006-4375AFB7` | USD/ZAR | revalued | 16.3971 | 16.4674 | 49 006,12 | twelve-data |
| `SIM-1779900492454-6C740F4E` | GBP/ZAR | revalued | 21.9863 | 22.0370 | 3 584,78 | twelve-data |
| `SIM-1779900493334-E1055D40` | GBP/ZAR | revalued | 21.9942 | 22.0370 | 463,82 | twelve-data |
| `SIM-1779900494316-373477DD` | GBP/ZAR | revalued | 21.9770 | 22.0370 | 17 323,60 | twelve-data |
| `SIM-1779900495455-8BB88A06` | GBP/ZAR | revalued | 22.0070 | 22.0370 | 1 848,74 | twelve-data |
| `SIM-1779900495952-9BDA154D` | USD/ZAR | revalued | 16.3834 | 16.4674 | 3 085,64 | twelve-data |
| `SIM-1779900496629-237A0A4C` | USD/ZAR | revalued | 16.3863 | 16.4674 | 16 444,03 | twelve-data |
| `SIM-1779900497062-D0881C7F` | GBP/ZAR | revalued | 21.9920 | 22.0370 | 4 619,07 | twelve-data |
| `SIM-1779900497829-87FE24BC` | GBP/ZAR | revalued | 21.9714 | 22.0370 | 4 419,47 | twelve-data |
| `SIM-1779900498502-632EAFD9` | USD/ZAR | revalued | 16.3816 | 16.4674 | 23 696,47 | twelve-data |
| `SIM-1779900499510-49059968` | GBP/ZAR | revalued | 22.0068 | 22.0370 | 230,76 | twelve-data |
| `SIM-1779900500343-F9A42661` | GBP/ZAR | revalued | 21.9722 | 22.0370 | 1 204,05 | twelve-data |
| `SIM-1779900500824-EB65549A` | GBP/ZAR | revalued | 21.9773 | 22.0370 | 7 324,13 | twelve-data |
| `SIM-1779900501496-340DFAF5` | GBP/ZAR | revalued | 21.9877 | 22.0370 | 10 078,53 | twelve-data |
| `SIM-1779900502311-3ECAFBFD` | USD/ZAR | revalued | 16.3804 | 16.4674 | 1 371,69 | twelve-data |
| `SIM-1779900503138-5C420680` | USD/ZAR | revalued | 16.3856 | 16.4674 | 1 858,06 | twelve-data |
| `SIM-1779900503889-78A8552C` | USD/ZAR | revalued | 16.3675 | 16.4674 | 26 438,86 | twelve-data |
| `SIM-1779900504851-2802A1C1` | GBP/ZAR | revalued | 21.9846 | 22.0370 | 5 176,97 | twelve-data |
| `SIM-1779900505866-8E42ECFF` | USD/ZAR | revalued | 16.3976 | 16.4674 | 51 493,70 | twelve-data |
| `SIM-1779900506843-DBE2CE75` | GBP/ZAR | revalued | 22.0026 | 22.0370 | 6 107,76 | twelve-data |
| `SIM-1779900507625-DB2F197D` | GBP/ZAR | revalued | 21.9873 | 22.0370 | 5 700,37 | twelve-data |
| `SIM-1779900508453-DDA4C1B6` | GBP/ZAR | revalued | 21.9832 | 22.0370 | 11 002,21 | twelve-data |
| `SIM-1779900508994-1F0D89F3` | GBP/ZAR | revalued | 21.9808 | 22.0370 | 6 455,95 | twelve-data |
| `SIM-1779900510031-44DE2FA5` | USD/ZAR | revalued | 16.3807 | 16.4674 | 21 610,73 | twelve-data |
| `SIM-1779900510628-93115E4C` | GBP/ZAR | revalued | 21.9956 | 22.0370 | 9 287,80 | twelve-data |
| `SIM-1779900511335-1C744EA6` | USD/ZAR | revalued | 16.3964 | 16.4674 | 83 536,61 | twelve-data |
| `SIM-1779900511844-16D18900` | GBP/ZAR | revalued | 21.9764 | 22.0370 | 17 657,11 | twelve-data |
| `SIM-1779900512667-3C8DCA67` | GBP/ZAR | revalued | 22.0021 | 22.0370 | 4 180,39 | twelve-data |
| `SIM-1779900513486-44FE4B85` | GBP/ZAR | revalued | 22.0072 | 22.0370 | 1 505,66 | twelve-data |
| `SIM-1779900514499-D0F03588` | GBP/ZAR | revalued | 21.9828 | 22.0370 | 15 052,39 | twelve-data |
| `SIM-1779900514965-299B8F34` | GBP/ZAR | revalued | 21.9799 | 22.0370 | 2 216,84 | twelve-data |
| `SIM-1779900515515-9E6BBEF3` | USD/ZAR | revalued | 16.3838 | 16.4674 | 4 708,81 | twelve-data |
| `SIM-1779900516648-B2B028EB` | GBP/ZAR | revalued | 21.9865 | 22.0370 | 1 053,47 | twelve-data |
| `SIM-1779900517543-59770FEE` | USD/ZAR | revalued | 16.3911 | 16.4674 | 18 029,99 | twelve-data |
| `SIM-1779900518130-F0C65590` | GBP/ZAR | revalued | 21.9722 | 22.0370 | 585,62 | twelve-data |
| `SIM-1779900518875-D1282FB8` | GBP/ZAR | revalued | 21.9720 | 22.0370 | 14 854,23 | twelve-data |
| `SIM-1779900519545-6EB0FB75` | USD/ZAR | revalued | 16.3671 | 16.4674 | 10 675,69 | twelve-data |
| `SIM-1779900520081-3454FB8A` | GBP/ZAR | revalued | 21.9714 | 22.0370 | 1 657,97 | twelve-data |
| `SIM-1779900521192-D262533A` | USD/ZAR | revalued | 16.3906 | 16.4674 | 858,78 | twelve-data |
| `SIM-1779900521885-504EC7C1` | USD/ZAR | revalued | 16.3787 | 16.4674 | 12 267,80 | twelve-data |
| `SIM-1779900522497-83158677` | GBP/ZAR | revalued | 21.9986 | 22.0370 | 3 099,77 | twelve-data |
| `SIM-1779900523486-5C071330` | GBP/ZAR | revalued | 22.0044 | 22.0370 | 8 604,69 | twelve-data |
| `SIM-1779900524493-E8055FDE` | USD/ZAR | revalued | 16.3974 | 16.4674 | 50 958,89 | twelve-data |
| `SIM-1779900525514-4C9EFDAC` | GBP/ZAR | revalued | 21.9896 | 22.0370 | 5 475,86 | twelve-data |
| `SIM-1779900526057-AAAC437D` | GBP/ZAR | revalued | 22.0030 | 22.0370 | 4 995,22 | twelve-data |
| `SIM-1779900526973-10BCD1BF` | GBP/ZAR | revalued | 21.9953 | 22.0370 | 382,96 | twelve-data |
| `SIM-1779900527586-05D76AA2` | GBP/ZAR | revalued | 21.9782 | 22.0370 | 2 021,44 | twelve-data |
| `SIM-1779900528153-2B9AAB1C` | USD/ZAR | revalued | 16.3672 | 16.4674 | 46 838,49 | twelve-data |
| `SIM-1779900528843-CCABC2E7` | GBP/ZAR | revalued | 22.0042 | 22.0370 | 2 253,74 | twelve-data |
| `SIM-1779900529620-AD22D604` | GBP/ZAR | revalued | 22.0121 | 22.0370 | 921,82 | twelve-data |
| `SIM-1779900530600-AA557909` | GBP/ZAR | revalued | 21.9793 | 22.0370 | 659,86 | twelve-data |
| `SIM-1779900531390-B55C54C2` | GBP/ZAR | revalued | 21.9866 | 22.0370 | 20 896,88 | twelve-data |
| `SIM-1779900531762-EA6608F3` | USD/ZAR | revalued | 16.3924 | 16.4674 | 11 484,75 | twelve-data |
| `SIM-1779900532453-7B8E4AF0` | EUR/USD | skipped-no-mark | 1.0791 | — | 0,00 | — |
| `SIM-1779900533417-96032FC5` | EUR/ZAR | revalued | 19.0658 | 19.0919 | 10 849,51 | twelve-data |

## Skip reasons

- no production tick and no prior revaluation for EUR/USD
- bond MTM: no JSE price feed connected — skipped
- equity MTM: no JSE equity feed connected — skipped
- IRD MTM: no curve ingest connected — skipped

## Substrate gaps

- **Production FX feed** — Reuters WM-Fix or Bloomberg BFIX ingest not yet wired. While absent, every open position falls back to stale-mark carry-forward and the daily SubstrateAlert (`alert:integrity:mtm-stale-mark-<date>`) fires. Recommended brief: `WS-MTM-PROD-FX-FEED`.
- **JSE bond price feed** — bond MTM is blocked on the JSE EOD bond-price ingest. Recommended brief: `WS-MTM-JSE-BOND-FEED`.
- **JIBAR / swap curve ingest** — IRD MTM is blocked on JIBAR + ZAR-OIS curve ingest. Recommended brief: `WS-MTM-JIBAR-CURVE-INGEST`.
- **JSE equity feed** — equity MTM is blocked on the JSE EOD equity-price ingest. Recommended brief: `WS-MTM-JSE-EQUITY-FEED`.

## Provenance

Open FX positions resolved by replaying `FxTradeExecuted` minus `FxTradeCancelled` minus `SettlementConfirmed`/`TradeMatured` from the composition-root event store. Marks elected via `MarketDataStore.query({provenance:"production"})` (latest tick per pair); stale-mark fallback reads the most-recent prior `FxPositionRevalued` for the position. `OfficialMarkAdopted` emitted via `adoptFxMark` per D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1. Recon gate: `recon:mtm-reversal-paired-with-reval` asserts per-position-day reversal/revaluation pairing.
