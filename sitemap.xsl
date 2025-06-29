---
layout: xslt
title: Sitemap
---

<h1>Sitemap</h1>
<p>以下是本站的所有链接：</p>
<ul>
  <xsl:for-each select="sm:urlset">
    <xsl:for-each select="sm:url">
        <li>
            <a>
                <xsl:attribute name="href"><xsl:value-of select="sm:loc" /></xsl:attribute>
                <xsl:value-of select="sm:loc" />
            </a>
        </li>
    </xsl:for-each>
  </xsl:for-each>
</ul>